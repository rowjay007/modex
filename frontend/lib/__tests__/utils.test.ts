import { describe, it, expect } from 'vitest'
import { cn, formatDate, formatCurrency } from '../utils'

describe('Utils', () => {
  describe('cn function', () => {
    it('should merge class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2')
    })

    it('should handle conditional classes', () => {
      expect(cn('class1', false && 'class2', 'class3')).toBe('class1 class3')
    })

    it('should handle tailwind merge conflicts', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    })

    it('should handle undefined and null values', () => {
      expect(cn('class1', undefined, null, 'class2')).toBe('class1 class2')
    })
  })

  describe('formatDate function', () => {
    it('should format date correctly', () => {
      const date = new Date('2023-12-25')
      const formatted = formatDate(date)
      expect(formatted).toBe('Dec 25, 2023')
    })

    it('should handle date string', () => {
      const formatted = formatDate('2023-12-25')
      expect(formatted).toBe('Dec 25, 2023')
    })
  })

  describe('formatCurrency function', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(99.99)).toBe('$99.99')
    })

    it('should handle integer values', () => {
      expect(formatCurrency(100)).toBe('$100.00')
    })

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('$0.00')
    })

    it('should handle large numbers', () => {
      expect(formatCurrency(1299.99)).toBe('$1,299.99')
    })
  })
})
