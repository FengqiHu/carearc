import React from 'react'

const RISK_CONFIG = {
  low: {
    bg: 'rgba(20,158,97,0.16)',
    text: '#026b3f',
    label: 'Low Risk',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L3 7V12C3 16.55 6.84 20.74 12 22C17.16 20.74 21 16.55 21 12V7L12 2Z" fill="currentColor" fillOpacity="0.25"/>
        <path d="M10 14.5L7.5 12L6.5 13L10 16.5L17.5 9L16.5 8L10 14.5Z" fill="currentColor"/>
      </svg>
    ),
  },
  medium: {
    bg: 'rgba(245,158,11,0.16)',
    text: '#92400e',
    label: 'Medium Risk',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 20H22L12 2Z" fill="currentColor" fillOpacity="0.2"/>
        <path d="M12 9V13M12 16V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  high: {
    bg: 'rgba(220,38,38,0.16)',
    text: '#991b1b',
    label: 'High Risk',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.2"/>
        <path d="M12 7V13M12 16V17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
  },
}

const SIZE_CLASSES = {
  sm: { padding: '2px 8px', fontSize: '11px', gap: '4px', iconSize: 12 },
  md: { padding: '4px 12px', fontSize: '13px', gap: '6px', iconSize: 14 },
  lg: { padding: '8px 16px', fontSize: '15px', gap: '8px', iconSize: 18 },
}

export default function RiskBadge({ level = 'low', size = 'md' }) {
  const normalizedLevel = (level || 'low').toLowerCase()
  const config = RISK_CONFIG[normalizedLevel] || RISK_CONFIG.low
  const sizeStyle = SIZE_CLASSES[size] || SIZE_CLASSES.md

  return (
    <span
      className="inline-flex items-center font-semibold rounded-lg select-none"
      style={{
        background: config.bg,
        color: config.text,
        padding: sizeStyle.padding,
        fontSize: sizeStyle.fontSize,
        gap: sizeStyle.gap,
        borderRadius: '8px',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', color: config.text }}>
        {React.cloneElement(config.icon, {
          width: sizeStyle.iconSize,
          height: sizeStyle.iconSize,
        })}
      </span>
      {config.label}
    </span>
  )
}
