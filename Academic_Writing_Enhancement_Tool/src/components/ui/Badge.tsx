interface BadgeProps {
  label: string
  variant?: 'pending' | 'processing' | 'done' | 'accepted' | 'error' | 'default'
}

const variantClass = {
  pending: 'bg-gray-100 text-gray-600',
  processing: 'bg-blue-50 text-blue-600 animate-pulse',
  done: 'bg-yellow-50 text-yellow-700',
  accepted: 'bg-green-50 text-green-700',
  error: 'bg-red-50 text-red-600',
  default: 'bg-gray-100 text-gray-600',
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${variantClass[variant]}`}>
      {label}
    </span>
  )
}

export function statusLabel(status: string): { label: string; variant: BadgeProps['variant'] } {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    pending: { label: '待处理', variant: 'pending' },
    processing: { label: '处理中', variant: 'processing' },
    done: { label: '已生成', variant: 'done' },
    accepted: { label: '已接受', variant: 'accepted' },
    error: { label: '生成失败', variant: 'error' },
    reverted: { label: '已撤销', variant: 'pending' },
  }
  return map[status] ?? { label: status, variant: 'default' }
}
