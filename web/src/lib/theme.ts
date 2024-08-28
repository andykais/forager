import resolveConfig from 'tailwindcss/resolveConfig'

const tailwind_config = resolveConfig({})

export const colors = tailwind_config.theme.colors
