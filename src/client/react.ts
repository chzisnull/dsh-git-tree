// React comes from the Harness module table at runtime; the bundle never
// installs its own copy. `require` here is the module-loader facade handed to
// the factory in the built artifact, so this file is the only place that
// touches it.
declare const require: (specifier: string) => any

export const React: any = require('react')
export const h = React.createElement
