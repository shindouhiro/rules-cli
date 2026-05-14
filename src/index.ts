// Core modules
export { AGENTS, expandHome, getAgentById, getAgentsByIds } from '~/core/agents'
export { loadConfig, saveConfig } from '~/core/config'
export { downloadCursorDirectoryRule, isCursorDirectorySource, searchCursorDirectoryRules } from '~/core/cursor-directory'
export { injectRuleToSingleFileAgent, linkRuleToDirectoryAgent, removeRuleFromSingleFileAgent, removeRuleReferencesFromDirectoryAgent } from '~/core/linker'
export { downloadRule, searchAllRemoteSources, searchRemoteRules } from '~/core/remote'
export { getRuleByName, parseRuleMeta, scanStoreRuleEntries, scanStoreRules, searchRules } from '~/core/scanner'
export { ensureStoreDir, getGlobalStoreDir, getProjectStoreDir, getStoreDir, getStoreRuleDir, listStoreRuleNames } from '~/core/store'

// Types
export type { AgentRulesDef, ResolvedRuleReference, RuleInfo, RuleMeta, RuleReference, RulesConfig, RuleSource, RulesType, ScopedRuleInfo } from '~/types'
