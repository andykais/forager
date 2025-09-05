import z from 'zod'
import * as forager from '@forager/core'
import * as forager_web from '@forager/web'


const LogLevel = z.enum(['SILENT', 'ERROR', 'WARN', 'INFO', 'DEBUG'])

export const Config = forager_web.PackagesConfig
