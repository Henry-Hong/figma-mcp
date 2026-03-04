import { describe, it, expect, vi } from 'vitest';
import { getVariableDefs } from '../../src/tools/get-variable-defs.js';
import type { FigmaClient } from '../../src/figma-client.js';
import fileVariablesFixture from '../fixtures/file-variables.json' assert { type: 'json' };
import variables403Fixture from '../fixtures/variables-403-response.json' assert { type: 'json' };

describe('getVariableDefs', () => {
  describe('normal case', () => {
    it('returns variables from file-variables fixture', async () => {
      const client = {
        getFileVariables: vi.fn().mockResolvedValue(fileVariablesFixture),
        getFileNodes: vi.fn(),
        getImages: vi.fn(),
      } as unknown as FigmaClient;

      const result = await getVariableDefs(client, 'fileKey');

      expect(result.source).toBe('api');
      if (result.source === 'api') {
        expect(result.variables).toHaveLength(1);
        expect(result.variables[0].id).toBe('var:1');
        expect(result.variables[0].name).toBe('color/primary');
        expect(result.variables[0].type).toBe('COLOR');
        expect(result.variables[0].value).toEqual({ r: 0.2, g: 0.4, b: 0.8, a: 1 });
      }
    });
  });

  describe('403 fallback case', () => {
    it('returns boundVariables when API returns 403', async () => {
      const nodeWithBoundVars = variables403Fixture.nodeWithBoundVariables;
      const nodeResponse = {
        nodes: {
          [nodeWithBoundVars.id]: { document: nodeWithBoundVars },
        },
      };

      const client = {
        getFileVariables: vi.fn().mockRejectedValue({ status: 403, message: 'Forbidden' }),
        getFileNodes: vi.fn().mockResolvedValue(nodeResponse),
        getImages: vi.fn(),
      } as unknown as FigmaClient;

      const result = await getVariableDefs(client, 'fileKey', nodeWithBoundVars.id);

      expect(result.source).toBe('boundVariables');
      if (result.source === 'boundVariables') {
        expect(result.message).toContain('Enterprise plan');
        expect(result.variables).toHaveLength(1);
        expect(result.variables[0].variableId).toBe('var:1');
        expect(result.variables[0].boundTo).toBe('fills');
      }
    });

    it('returns empty variables with Enterprise plan message when no nodeId given on 403', async () => {
      const client = {
        getFileVariables: vi.fn().mockRejectedValue({ status: 403, message: 'Forbidden' }),
        getFileNodes: vi.fn(),
        getImages: vi.fn(),
      } as unknown as FigmaClient;

      const result = await getVariableDefs(client, 'fileKey');

      expect(result.source).toBe('boundVariables');
      if (result.source === 'boundVariables') {
        expect(result.message).toContain('Enterprise plan');
        expect(result.variables).toEqual([]);
      }
    });
  });
});
