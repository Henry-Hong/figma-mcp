import { describe, it, expect, vi } from 'vitest';
import { getSectionFrames, flattenTree } from '../../src/tools/get-section-frames.js';
import type { FigmaClient } from '../../src/figma-client.js';
import sectionNodeFixture from '../fixtures/section-node.json' assert { type: 'json' };

function makeMockClient(response: unknown): FigmaClient {
  return {
    getFileNodes: vi.fn().mockResolvedValue(response),
    getImages: vi.fn(),
    getFileVariables: vi.fn(),
  } as unknown as FigmaClient;
}

describe('getSectionFrames', () => {
  it('returns 2 frames in the tree from section-node fixture', async () => {
    const client = makeMockClient(sectionNodeFixture);
    const result = await getSectionFrames(client, 'fileKey', '24626:7077');

    expect(result.tree).toHaveLength(2);
    expect(result.tree[0].id).toBe('24626:6637');
    expect(result.tree[0].name).toBe('학습설정-진입');
    expect(result.tree[0].type).toBe('FRAME');
    expect(result.tree[1].id).toBe('24626:6654');
    expect(result.tree[1].name).toBe('학습설정-완료');
    expect(result.tree[1].type).toBe('FRAME');
  });

  it('returns correct width and height from absoluteBoundingBox', async () => {
    const client = makeMockClient(sectionNodeFixture);
    const result = await getSectionFrames(client, 'fileKey', '24626:7077');

    expect(result.tree[0].width).toBe(360);
    expect(result.tree[0].height).toBe(720);
  });

  it('sets hasInteractions=true for frame with interactions', async () => {
    const client = makeMockClient(sectionNodeFixture);
    const result = await getSectionFrames(client, 'fileKey', '24626:7077');

    expect(result.tree[0].hasInteractions).toBe(true);
  });

  it('sets hasInteractions=false for frame without interactions', async () => {
    const client = makeMockClient(sectionNodeFixture);
    const result = await getSectionFrames(client, 'fileKey', '24626:7077');

    expect(result.tree[1].hasInteractions).toBe(false);
  });

  it('returns nested sections as children', async () => {
    const nestedFixture = {
      nodes: {
        'sec:1': {
          document: {
            id: 'sec:1',
            name: 'Root Section',
            type: 'SECTION',
            children: [
              {
                id: 'sec:2',
                name: 'Child Section',
                type: 'SECTION',
                children: [
                  {
                    id: 'frame:1',
                    name: 'Nested Frame',
                    type: 'FRAME',
                    absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 200 },
                    interactions: [],
                  },
                ],
                absoluteBoundingBox: { x: 0, y: 0, width: 500, height: 500 },
              },
              {
                id: 'frame:2',
                name: 'Top Frame',
                type: 'FRAME',
                absoluteBoundingBox: { x: 0, y: 0, width: 360, height: 720 },
                interactions: [],
              },
            ],
          },
        },
      },
    };
    const client = makeMockClient(nestedFixture);
    const result = await getSectionFrames(client, 'fileKey', 'sec:1');

    expect(result.tree).toHaveLength(2);
    expect(result.tree[0].type).toBe('SECTION');
    expect(result.tree[0].name).toBe('Child Section');
    expect(result.tree[0].children).toHaveLength(1);
    expect(result.tree[0].children![0].name).toBe('Nested Frame');
    expect(result.tree[1].type).toBe('FRAME');
    expect(result.tree[1].name).toBe('Top Frame');
  });

  it('flattenTree extracts all FRAME and INSTANCE nodes from nested tree', () => {
    const tree = [
      {
        id: 'sec:1', name: 'Section', type: 'SECTION' as const,
        width: 0, height: 0, hasInteractions: false,
        children: [
          { id: 'f:1', name: 'Frame 1', type: 'FRAME' as const, width: 100, height: 200, hasInteractions: false },
          { id: 'i:1', name: 'Instance 1', type: 'INSTANCE' as const, width: 100, height: 200, hasInteractions: false },
        ],
      },
      { id: 'f:2', name: 'Frame 2', type: 'FRAME' as const, width: 100, height: 200, hasInteractions: false },
    ];

    const flat = flattenTree(tree);
    expect(flat).toHaveLength(3);
    expect(flat.map(n => n.id)).toEqual(['f:1', 'i:1', 'f:2']);
  });

  it('throws when node is not a SECTION type', async () => {
    const nonSectionFixture = {
      nodes: {
        'node:1': {
          document: {
            id: 'node:1',
            name: 'Some Frame',
            type: 'FRAME',
            children: [],
          },
        },
      },
    };
    const client = makeMockClient(nonSectionFixture);

    await expect(getSectionFrames(client, 'fileKey', 'node:1')).rejects.toThrow(
      'not a SECTION type',
    );
  });

  it('throws when node is not found', async () => {
    const client = makeMockClient({ nodes: {} });

    await expect(getSectionFrames(client, 'fileKey', 'missing:id')).rejects.toThrow(
      'not found',
    );
  });
});
