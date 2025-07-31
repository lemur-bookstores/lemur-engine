/**
 * Valida el nombre del plugin según las reglas establecidas:
 * - Solo letras minúsculas, números y guiones
 * - Debe comenzar con una letra
 * - Longitud entre 3 y 50 caracteres
 */
export function validatePluginName(name: string): void {
  const validNameRegex = /^[a-z][a-z0-9-]*$/;
  
  if (name.length < 3 || name.length > 50) {
    throw new Error('El nombre del plugin debe tener entre 3 y 50 caracteres');
  }

  if (!validNameRegex.test(name)) {
    throw new Error('El nombre del plugin solo puede contener letras minúsculas, números y guiones, y debe comenzar con una letra');
  }
}

/**
 * Valida el nombre del servicio según las reglas establecidas:
 * - Solo letras, números y guiones bajos
 * - Debe comenzar con una letra
 * - Longitud entre 3 y 50 caracteres
 */
export function validateServiceName(name: string): void {
  const validNameRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;

  if (name.length < 3 || name.length > 50) {
    throw new Error('El nombre del servicio debe tener entre 3 y 50 caracteres');
  }

  if (!validNameRegex.test(name)) {
    throw new Error('El nombre del servicio solo puede contener letras, números y guiones bajos, y debe comenzar con una letra');
  }
}

/**
 * Valida la versión según el formato semver
 */
export function validateVersion(version: string): void {
  const semverRegex = /^\d+\.\d+\.\d+$/;

  if (!semverRegex.test(version)) {
    throw new Error('La versión debe seguir el formato semver (x.y.z)');
  }
}

/**
 * Valida el nombre del autor
 */
export function validateAuthor(author: string): void {
  if (author.length < 2 || author.length > 100) {
    throw new Error('El nombre del autor debe tener entre 2 y 100 caracteres');
  }
}

/**
 * Valida la descripción
 */
export function validateDescription(description: string): void {
  if (description.length < 10 || description.length > 500) {
    throw new Error('La descripción debe tener entre 10 y 500 caracteres');
  }
}