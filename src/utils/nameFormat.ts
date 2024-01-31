export function nameFormat(name: string): string {
  return name.split('').map((c, i) => c >= 'A' && c <= 'Z'
    ? i > 0
      ? '-' + c.toLowerCase()
      : c.toLowerCase()
    : c).join('')
}
