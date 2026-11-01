export const courses = [
  { slug: 'c2-matlab', name: 'C2 数学实验（MATLAB）', english: 'C2 Mathematical Experiments (MATLAB)' },
  { slug: 'data-structures', name: '数据结构', english: 'Data Structures' },
  { slug: 'mathematics-competition', name: '数学竞赛（数学专业类）', english: 'Mathematics Competition (Mathematics Majors)' },
  { slug: 'equations-of-mathematical-physics', name: '数学物理方程', english: 'Equations of Mathematical Physics' },
  { slug: 'functional-analysis', name: '泛函分析', english: 'Functional Analysis' },
  { slug: 'mathematical-statistics', name: '数理统计', english: 'Mathematical Statistics' },
  { slug: 'fundamentals-of-intelligent-computing', name: '智能计算基础', english: 'Fundamentals of Intelligent Computing' },
  { slug: 'stochastic-processes', name: '随机过程', english: 'Stochastic Processes' },
  { slug: 'reinforcement-learning', name: '强化学习与科研入门', english: 'Reinforcement Learning and Research Foundations' },
] as const

export const courseForPath = (path: string) => path.startsWith('/notes/')
  ? courses.find(course => course.slug === path.split('/')[2])
  : undefined
