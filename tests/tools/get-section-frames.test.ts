import { describe, it, expect, vi } from 'vitest';
import { getSectionFrames } from '../../src/tools/get-section-frames.js';
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
  it('returns 2 frames from section-node fixture', async () => {
    const client = makeMockClient(sectionNodeFixture);
    const result = await getSectionFrames(client, 'fileKey', '24626:7077');

    expect(result.frames).toHaveLength(2);
    expect(result.frames[0].id).toBe('24626:6637');
    expect(result.frames[0].name).toBe('학습설정-진입');
    expect(result.frames[1].id).toBe('24626:6654');
    expect(result.frames[1].name).toBe('학습설정-완료');
  });

  it('returns correct width and height from absoluteBoundingBox', async () => {
    const client = makeMockClient(sectionNodeFixture);
    const result = await getSectionFrames(client, 'fileKey', '24626:7077');

    expect(result.frames[0].width).toBe(360);
    expect(result.frames[0].height).toBe(720);
  });

  it('sets hasInteractions=true for frame with interactions', async () => {
    const client = makeMockClient(sectionNodeFixture);
    const result = await getSectionFrames(client, 'fileKey', '24626:7077');

    expect(result.frames[0].hasInteractions).toBe(true);
  });

  it('sets hasInteractions=false for frame without interactions', async () => {
    const client = makeMockClient(sectionNodeFixture);
    const result = await getSectionFrames(client, 'fileKey', '24626:7077');

    expect(result.frames[1].hasInteractions).toBe(false);
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
