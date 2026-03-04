import { describe, it, expect, vi } from 'vitest';
import { getFlowMap } from '../../src/tools/get-flow-map.js';
import type { FigmaClient } from '../../src/figma-client.js';
import sectionNodeFixture from '../fixtures/section-node.json' assert { type: 'json' };
import largeSectionFixture from '../fixtures/large-section-60-frames.json' assert { type: 'json' };

describe('getFlowMap', () => {
  describe('normal case', () => {
    it('returns nodes, edges, and entryPoints from section-node fixture', async () => {
      // New logic: getSectionFrames (depth=2) then one full-section fetch (no depth)
      const getFileNodes = vi.fn()
        .mockResolvedValueOnce(sectionNodeFixture)  // getSectionFrames call
        .mockResolvedValueOnce(sectionNodeFixture); // full section fetch for interactions

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
      expect(result.edges[0].fromName).toBe('학습설정-진입');
      expect(result.edges[0].sourceFrameId).toBe('24626:6637');
      expect(result.edges[0].sourceFrameName).toBe('학습설정-진입');
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
    it('fetches section once for frames and once for interactions (2 getFileNodes calls total)', async () => {
      const getFileNodes = vi.fn()
        // Call 1: getSectionFrames fetches the section node
        .mockResolvedValueOnce(largeSectionFixture)
        // Call 2: full section fetch for interactions
        .mockResolvedValueOnce(largeSectionFixture);

      const client = {
        getFileNodes,
        getImages: vi.fn(),
        getFileVariables: vi.fn(),
      } as unknown as FigmaClient;

      const result = await getFlowMap(client, 'fileKey', 'section:large');

      // 1 (getSectionFrames) + 1 (full section fetch) = 2 total calls
      expect(getFileNodes).toHaveBeenCalledTimes(2);

      expect(result.nodes).toHaveLength(60);
      expect(result.edges).toHaveLength(0);
      // All 60 frames are entry points (no incoming edges)
      expect(result.entryPoints).toHaveLength(60);
    });
  });
});
