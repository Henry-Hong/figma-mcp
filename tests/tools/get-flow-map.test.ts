import { describe, it, expect, vi } from 'vitest';
import { getFlowMap } from '../../src/tools/get-flow-map.js';
import type { FigmaClient } from '../../src/figma-client.js';
import sectionNodeFixture from '../fixtures/section-node.json' assert { type: 'json' };
import largeSectionFixture from '../fixtures/large-section-60-frames.json' assert { type: 'json' };

describe('getFlowMap', () => {
  describe('normal case', () => {
    it('returns nodes, edges, and entryPoints from section-node fixture', async () => {
      // getSectionFrames calls getFileNodes with depth=2 first,
      // then getFlowMap calls getFileNodes again for interactions with the same IDs
      const children = sectionNodeFixture.nodes['24626:7077'].document.children;
      const interactionsResponse = {
        nodes: {
          '24626:6637': { document: children[0] },
          '24626:6654': { document: children[1] },
        },
      };

      const getFileNodes = vi.fn()
        .mockResolvedValueOnce(sectionNodeFixture)       // getSectionFrames call
        .mockResolvedValueOnce(interactionsResponse);    // batch interaction fetch

      const client = {
        getFileNodes,
        getImages: vi.fn(),
        getFileVariables: vi.fn(),
      } as unknown as FigmaClient;

      const result = await getFlowMap(client, 'fileKey', '24626:7077');

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes.map((n) => n.id)).toContain('24626:6637');
      expect(result.nodes.map((n) => n.id)).toContain('24626:6654');

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].from).toBe('24626:6637');
      expect(result.edges[0].to).toBe('24626:6654');
      expect(result.edges[0].trigger).toBe('ON_CLICK');
      expect(result.edges[0].action).toBe('NAVIGATE');

      // 24626:6637 has no incoming edges → it is an entry point
      expect(result.entryPoints).toContain('24626:6637');
      // 24626:6654 has incoming edge → not an entry point
      expect(result.entryPoints).not.toContain('24626:6654');
    });
  });

  describe('50+ frames chunking', () => {
    it('splits 60 frames into 25-frame batches (3 getFileNodes calls total)', async () => {
      // Build a response map for the 60 frames — no interactions, so edges = []
      const frameNodes = largeSectionFixture.nodes['section:large'].document.children;

      function makeBatchResponse(frames: typeof frameNodes) {
        const nodes: Record<string, { document: (typeof frameNodes)[number] }> = {};
        for (const frame of frames) {
          nodes[frame.id] = { document: frame };
        }
        return { nodes };
      }

      const getFileNodes = vi.fn()
        // Call 1: getSectionFrames fetches the section node
        .mockResolvedValueOnce(largeSectionFixture)
        // Calls 2 & 3: two 25-frame batches (60 > 50 threshold → chunked into ceil(60/25)=3 but BATCH_SIZE=25 so chunk([60], 25) → [25,25,10])
        .mockResolvedValueOnce(makeBatchResponse(frameNodes.slice(0, 25)))
        .mockResolvedValueOnce(makeBatchResponse(frameNodes.slice(25, 50)))
        .mockResolvedValueOnce(makeBatchResponse(frameNodes.slice(50, 60)));

      const client = {
        getFileNodes,
        getImages: vi.fn(),
        getFileVariables: vi.fn(),
      } as unknown as FigmaClient;

      const result = await getFlowMap(client, 'fileKey', 'section:large');

      // 1 (section fetch) + 3 (batched frame fetches) = 4 total calls
      expect(getFileNodes).toHaveBeenCalledTimes(4);

      expect(result.nodes).toHaveLength(60);
      expect(result.edges).toHaveLength(0);
      // All 60 frames are entry points (no incoming edges)
      expect(result.entryPoints).toHaveLength(60);
    });
  });
});
