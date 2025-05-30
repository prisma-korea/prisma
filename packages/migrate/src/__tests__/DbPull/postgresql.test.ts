// describeIf is making eslint unhappy about the test names

import { defaultTestConfig } from '@prisma/config'
import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import path from 'path'

import { DbPull } from '../../commands/DbPull'
import { SetupParams, setupPostgres, tearDownPostgres } from '../../utils/setupPostgres'
import CaptureStdout from '../__helpers__/captureStdout'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describe('postgresql', () => {
  const captureStdout = new CaptureStdout()

  beforeEach(() => {
    captureStdout.startCapture()
  })

  afterEach(() => {
    captureStdout.clearCaptureText()
  })

  afterAll(() => {
    captureStdout.stopCapture()
  })

  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace(
    'tests-migrate',
    'tests-migrate-db-pull-postgresql',
  )

  const setupParams: SetupParams = {
    connectionString,
    // Note: at this location there is a setup.sql file
    // which will be executed a SQL file so the database is not empty
    dirname: path.join(__dirname, '..', '..', '__tests__', 'fixtures', 'introspection', 'postgresql'),
  }

  beforeAll(async () => {
    await tearDownPostgres(setupParams).catch((e) => {
      console.error(e)
    })
  })

  beforeEach(async () => {
    await setupPostgres(setupParams).catch((e) => {
      console.error(e)
    })
    // Update env var because it's the one that is used in the schemas tested
    process.env.TEST_POSTGRES_URI_MIGRATE = connectionString
  })

  afterEach(async () => {
    await tearDownPostgres(setupParams).catch((e) => {
      console.error(e)
    })
  })

  test('basic introspection', async () => {
    ctx.fixture('introspection/postgresql')
    const introspect = new DbPull()
    const result = introspect.parse(['--print'], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)

    expect(captureStdout.getCapturedText().join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('basic introspection --url', async () => {
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)

    expect(captureStdout.getCapturedText().join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('basic introspection --url + empty schema', async () => {
    ctx.fixture('empty-schema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)

    expect(captureStdout.getCapturedText().join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('basic introspection --url + schema with no linebreak after generator block', async () => {
    ctx.fixture('generator-only')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--url', setupParams.connectionString], defaultTestConfig())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)

    expect(captureStdout.getCapturedText().join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('introspection should load .env file with --print', async () => {
    ctx.fixture('schema-only-postgresql')
    expect.assertions(3)

    try {
      await DbPull.new().parse(['--print', '--schema=./prisma/using-dotenv.prisma'], defaultTestConfig())
    } catch (e) {
      expect(e.code).toEqual('P1001')
      expect(e.message).toContain(`fromdotenvdoesnotexist`)
    }

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('introspection should load .env file without --print', async () => {
    ctx.fixture('schema-only-postgresql')
    expect.assertions(4)

    try {
      await DbPull.new().parse(['--schema=./prisma/using-dotenv.prisma'], defaultTestConfig())
    } catch (e) {
      expect(e.code).toEqual('P1001')
      expect(e.message).toContain(`fromdotenvdoesnotexist`)
    }

    expect(captureStdout.getCapturedText().join('\n')).toMatchInlineSnapshot(`
      "Environment variables loaded from prisma/.env

      Prisma schema loaded from prisma/using-dotenv.prisma

      Datasource "my_db": PostgreSQL database "mydb", schema "public" at "fromdotenvdoesnotexist:5432"



      - Introspecting based on datasource defined in prisma/using-dotenv.prisma

      ✖ Introspecting based on datasource defined in prisma/using-dotenv.prisma


      "
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('introspection --url with postgresql provider but schema has a sqlite provider should fail', async () => {
    ctx.fixture('schema-only-sqlite')
    expect.assertions(4)

    try {
      await DbPull.new().parse(['--url', setupParams.connectionString], defaultTestConfig())
    } catch (e) {
      expect(e.code).toEqual(undefined)
      expect(e.message).toMatchInlineSnapshot(
        `"The database provider found in --url (postgresql) is different from the provider found in the Prisma schema (sqlite)."`,
      )
    }

    expect(captureStdout.getCapturedText().join('\n')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma

      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"
      "
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('introspection works with directUrl from env var', async () => {
    ctx.fixture('schema-only-data-proxy')
    const result = DbPull.new().parse(['--schema', 'with-directUrl-env.prisma'], defaultTestConfig())

    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(captureStdout.getCapturedText().join('\n')).toMatchInlineSnapshot(`
      "Environment variables loaded from .env

      Prisma schema loaded from with-directUrl-env.prisma

      Datasource "db": PostgreSQL database "tests-migrate-db-pull-postgresql", schema "public" at "localhost:5432"



      - Introspecting based on datasource defined in with-directUrl-env.prisma

      ✔ Introspected 2 models and wrote them into with-directUrl-env.prisma in XXXms
            
      Run prisma generate to generate Prisma Client.
      "
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })
})
