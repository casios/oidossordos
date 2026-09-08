// apps/api/jest.config.js
// Los scripts de package.json separan pruebas unitarias (*.spec.ts) de las de
// integración (*.integration-spec.ts) con --testPathPattern; esta config es
// común a ambas. Las de integración corren con --runInBand porque comparten
// una sola base de datos Postgres (ver docs/Diseño de CI CD.md sección 2.4).
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testRegex: '\\.(spec|integration-spec)\\.ts$',
  collectCoverageFrom: ['**/*.ts', '!**/*.dto.ts', '!main.ts'],
};
