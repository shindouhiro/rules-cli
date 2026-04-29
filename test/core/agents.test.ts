import { describe, expect, it } from 'vitest'
import { AGENTS, expandHome, getAgentById, getAgentsByIds } from '~/core/agents'

describe('agents', () => {
  describe('aGENTS', () => {
    it('应包含 cursor agent', () => {
      const cursor = AGENTS.find(a => a.id === 'cursor')
      expect(cursor).toBeDefined()
      expect(cursor!.rulesType).toBe('directory')
      expect(cursor!.fileExtension).toBe('.mdc')
    })

    it('应包含 claude-code agent', () => {
      const claude = AGENTS.find(a => a.id === 'claude-code')
      expect(claude).toBeDefined()
      expect(claude!.rulesType).toBe('single-file')
      expect(claude!.injectMarkerStart).toBe('<!-- rules-cli:start -->')
    })

    it('所有 agent 应有唯一 id', () => {
      const ids = AGENTS.map(a => a.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('所有 directory 型 agent 应有 fileExtension', () => {
      const dirAgents = AGENTS.filter(a => a.rulesType === 'directory')
      for (const agent of dirAgents) {
        expect(agent.fileExtension).toBeDefined()
      }
    })

    it('所有 single-file 型 agent 应有注入标记', () => {
      const sfAgents = AGENTS.filter(a => a.rulesType === 'single-file')
      for (const agent of sfAgents) {
        expect(agent.injectMarkerStart).toBeDefined()
        expect(agent.injectMarkerEnd).toBeDefined()
      }
    })
  })

  describe('getAgentById', () => {
    it('查找存在的 agent', () => {
      const agent = getAgentById('cursor')
      expect(agent).toBeDefined()
      expect(agent!.name).toBe('Cursor')
    })

    it('查找不存在的 agent 返回 undefined', () => {
      expect(getAgentById('nonexistent')).toBeUndefined()
    })
  })

  describe('getAgentsByIds', () => {
    it('批量查找 agents', () => {
      const agents = getAgentsByIds(['cursor', 'claude-code'])
      expect(agents).toHaveLength(2)
      expect(agents[0].id).toBe('cursor')
      expect(agents[1].id).toBe('claude-code')
    })

    it('过滤不存在的 id', () => {
      const agents = getAgentsByIds(['cursor', 'nope', 'claude-code'])
      expect(agents).toHaveLength(2)
    })

    it('空列表返回空数组', () => {
      expect(getAgentsByIds([])).toEqual([])
    })
  })

  describe('expandHome', () => {
    it('展开 ~ 前缀', () => {
      const result = expandHome('~/foo/bar')
      expect(result).not.toContain('~')
      expect(result).toContain('foo/bar')
    })

    it('不含 ~ 的路径原样返回', () => {
      expect(expandHome('/absolute/path')).toBe('/absolute/path')
      expect(expandHome('relative/path')).toBe('relative/path')
    })
  })
})
