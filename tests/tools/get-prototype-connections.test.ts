import { describe, it, expect, vi } from 'vitest';
import { getPrototypeConnections } from '../../src/tools/get-prototype-connections.js';
import type { FigmaClient } from '../../src/figma-client.js';
import frameWithInteractionsFixture from '../fixtures/frame-with-interactions.json' assert { type: 'json' };

function makeMockClient(responses: unknown[]): FigmaClient {
  const getFileNodes = vi.fn();
  responses.forEach((resp) => {
    getFileNodes.mockResolvedValueOnce(resp);
  });
  return {
    getFileNodes,
    getImages: vi.fn(),
    getFileVariables: vi.fn(),
  } as unknown as FigmaClient;
}

describe('getPrototypeConnections', () => {
  it('returns connections from frame-with-interactions fixture', async () => {
    // First call: fetch the source node; second call: fetch destination nodes
    const sourceResponse = {
      nodes: {
        '24626:6637': frameWithInteractionsFixture.nodes['24626:6637'],
      },
    };
    const destResponse = {
      nodes: {
        '24626:6654': frameWithInteractionsFixture.nodes['24626:6654'],
      },
    };
    const client = makeMockClient([sourceResponse, destResponse]);

    const result = await getPrototypeConnections(client, 'fileKey', '24626:6637');

    expect(result.connections).toHaveLength(1);
    expect(result.connections[0].trigger).toBe('ON_CLICK');
    expect(result.connections[0].action).toBe('NAVIGATE');
    expect(result.connections[0].destinationId).toBe('24626:6654');
    expect(result.connections[0].destinationName).toBe('학습설정-완료');
  });

  it('returns empty connections array (not an error) for node with no interactions', async () => {
    const noInteractionsResponse = {
      nodes: {
        '24626:6654': frameWithInteractionsFixture.nodes['24626:6654'],
      },
    };
    const client = makeMockClient([noInteractionsResponse]);

    const result = await getPrototypeConnections(client, 'fileKey', '24626:6654');

    expect(result.connections).toEqual([]);
  });

  it('throws when node is not found', async () => {
    const client = makeMockClient([{ nodes: {} }]);

    await expect(
      getPrototypeConnections(client, 'fileKey', 'missing:id'),
    ).rejects.toThrow('not found');
  });
});
