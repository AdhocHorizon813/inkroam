export const courses = [
  { slug: 'equations-of-mathematical-physics', name: '数学物理方程', english: 'Equations of Mathematical Physics' },
  { slug: 'functional-analysis', name: '泛函分析', english: 'Functional Analysis' },
  { slug: 'mathematical-statistics', name: '数理统计', english: 'Mathematical Statistics' },
  { slug: 'fundamentals-of-intelligent-computing', name: '智能计算基础', english: 'Fundamentals of Intelligent Computing' },
  { slug: 'stochastic-processes', name: '随机过程', english: 'Stochastic Processes' },
] as const

export const courseForPath = (path: string) => path.startsWith('/notes/')
  ? courses.find(course => course.slug === path.split('/')[2])
  : undefined
