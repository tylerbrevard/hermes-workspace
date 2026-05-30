import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

const HOME = process.env.HOME || '/Users/tylerlyon'
const HERMES_WORKSPACE =
  process.env.HERMES_WORKSPACE || join(HOME, '.hermes', 'workspace')
const M5_DB =
  process.env.HERMES_M5_DISPLAY_DB ||
  join(HERMES_WORKSPACE, 'runtime', 'db', 'workspace', '.m5-display.db')
const FIRMWARE_DIR = join(HERMES_WORKSPACE, 'firmware')

type FirmwareRow = {
  version: string
  filename: string
  file_size: number
  description?: string
  uploaded_at?: string
}

type DeviceRow = {
  firmware_version?: string
}

function queryDb<T>(sql: string): Array<T> {
  if (!existsSync(M5_DB)) return []
  const output = execFileSync('sqlite3', ['-json', M5_DB, sql], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  }).trim()
  return output ? (JSON.parse(output) as Array<T>) : []
}

function execSql(sql: string) {
  if (!existsSync(M5_DB)) return
  execFileSync('sqlite3', [M5_DB, sql], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  })
}

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

function getFirmwareList() {
  return queryDb<FirmwareRow>(
    'select version, filename, file_size, description, uploaded_at from m5_firmware order by uploaded_at desc',
  )
}

function getDeviceFirmwareVersion(deviceId: string) {
  const rows = queryDb<DeviceRow>(
    `select firmware_version from m5_devices where device_id = ${sqlString(deviceId)} limit 1`,
  )
  return rows[0]?.firmware_version || null
}

export const Route = createFileRoute('/api/iot/m5-ota')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url)
          const download = url.searchParams.get('download')
          const version = url.searchParams.get('version')

          if (download === 'true' && version) {
            const firmware = getFirmwareList().find(
              (item) => item.version === version,
            )
            if (!firmware) {
              return json(
                { error: 'Firmware version not found' },
                { status: 404 },
              )
            }

            const filePath = join(FIRMWARE_DIR, firmware.filename)
            if (!existsSync(filePath)) {
              return json(
                { error: 'Firmware file not found on disk' },
                { status: 404 },
              )
            }

            const fileData = readFileSync(filePath)
            return new Response(fileData, {
              headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${firmware.filename}"`,
                'Content-Length': String(fileData.length),
                'Cache-Control': 'no-store',
              },
            })
          }

          const deviceId = url.searchParams.get('deviceId') || ''
          const reportedVersion =
            url.searchParams.get('currentVersion') ||
            url.searchParams.get('firmware') ||
            ''
          if (deviceId && reportedVersion) {
            execSql(
              `update m5_devices set firmware_version = ${sqlString(reportedVersion)} where device_id = ${sqlString(deviceId)};`,
            )
          }
          const allFirmware = getFirmwareList()
          const latest = allFirmware[0] || null
          const currentVersion = deviceId
            ? getDeviceFirmwareVersion(deviceId)
            : null

          return json({
            latest: latest
              ? {
                  version: latest.version,
                  file_size: latest.file_size,
                  uploaded_at: latest.uploaded_at,
                }
              : null,
            available: Boolean(
              latest && currentVersion && latest.version !== currentVersion,
            ),
            currentVersion,
            allVersions: allFirmware.map((firmware) => ({
              version: firmware.version,
              file_size: firmware.file_size,
              description: firmware.description,
              uploaded_at: firmware.uploaded_at,
            })),
          })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to process OTA request',
            },
            { status: 500 },
          )
        }
      },
      POST: async () => {
        mkdirSync(dirname(FIRMWARE_DIR), { recursive: true })
        return json(
          { error: 'Upload firmware from the local maintenance workflow.' },
          { status: 405 },
        )
      },
    },
  },
})
