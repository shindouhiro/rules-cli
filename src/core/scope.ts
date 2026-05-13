export interface ScopeOptions {
  global?: boolean
  project?: boolean
}

export function resolveIsGlobal(options: ScopeOptions): boolean {
  if (options.global && options.project) {
    throw new Error('不能同时指定 --global 和 --project')
  }

  if (options.project || options.global === false)
    return false
  if (options.global)
    return true

  // 默认全局作用域
  return true
}
