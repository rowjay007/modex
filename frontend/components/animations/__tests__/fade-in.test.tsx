import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { FadeIn } from '../fade-in'

describe('FadeIn Animation Component', () => {
  it('renders children correctly', () => {
    render(
      <FadeIn>
        <div>Test content</div>
      </FadeIn>
    )
    
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(
      <FadeIn className="custom-fade">
        <div>Test content</div>
      </FadeIn>
    )
    
    const container = screen.getByText('Test content').parentElement
    expect(container).toHaveClass('custom-fade')
  })

  it('renders with different directions', () => {
    const { rerender } = render(
      <FadeIn direction="up">
        <div>Test content</div>
      </FadeIn>
    )
    
    expect(screen.getByText('Test content')).toBeInTheDocument()

    rerender(
      <FadeIn direction="left">
        <div>Test content</div>
      </FadeIn>
    )
    
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('accepts delay and duration props', () => {
    render(
      <FadeIn delay={0.5} duration={1.2}>
        <div>Test content</div>
      </FadeIn>
    )
    
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })
})
