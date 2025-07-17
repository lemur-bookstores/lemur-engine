# Reglas de Control de Versiones

Este documento define las reglas y convenciones para el control de versiones en el proyecto Lemur Engine utilizando Gitflow.

## Extensión VS Code

Utilizamos la extensión [GitFlow for VS Code](https://github.com/vector-of-bool/vscode-gitflow) para facilitar el manejo del flujo de trabajo.

## Ramas Principales

### main

- Contiene el código en producción
- Solo recibe merges de:
  - Ramas `hotfix/*`
  - Ramas `release/*`
- Cada merge a main debe estar etiquetado con un número de versión

### develop

- Rama principal de desarrollo
- Contiene el código para la siguiente versión
- Recibe merges de:
  - Ramas `feature/*`
  - Ramas `bugfix/*`

## Tipos de Ramas

### Feature (feature/\*)

```bash
# Crear nueva feature
git flow feature start nombre-feature

# Trabajar en la feature...

# Finalizar feature
git flow feature finish nombre-feature
```

- Se ramifica desde: `develop`
- Se integra en: `develop`
- Convención de nombres: `feature/nombre-descriptivo`
- Uso: Nuevas funcionalidades y mejoras

### Bugfix (bugfix/\*)

```bash
# Crear nuevo bugfix
git flow bugfix start nombre-bugfix

# Trabajar en el bugfix...

# Finalizar bugfix
git flow bugfix finish nombre-bugfix
```

- Se ramifica desde: `develop`
- Se integra en: `develop`
- Convención de nombres: `bugfix/nombre-descriptivo`
- Uso: Correcciones de errores para la próxima versión

### Hotfix (hotfix/\*)

```bash
# Crear nuevo hotfix
git flow hotfix start nombre-hotfix

# Trabajar en el hotfix...

# Finalizar hotfix
git flow hotfix finish nombre-hotfix
```

- Se ramifica desde: `main`
- Se integra en: `main` y `develop`
- Convención de nombres: `hotfix/nombre-descriptivo`
- Uso: Correcciones urgentes en producción

### Release (release/\*)

```bash
# Crear nueva release
git flow release start v1.0.0

# Trabajar en la release...

# Finalizar release
git flow release finish v1.0.0
```

- Se ramifica desde: `develop`
- Se integra en: `main` y `develop`
- Convención de nombres: `release/vX.Y.Z`
- Uso: Preparación de nuevas versiones

## Convenciones de Commit

### Formato

```
<tipo>(<alcance>): <descripción>

[cuerpo]

[pie]
```

### Tipos de Commit

- `feat`: Nueva funcionalidad
- `fix`: Corrección de error
- `docs`: Cambios en documentación
- `style`: Cambios de formato
- `refactor`: Refactorización de código
- `test`: Agregar o modificar tests
- `chore`: Tareas de mantenimiento

### Ejemplos

```bash
feat(plugin): agregar sistema de carga automática
fix(kernel): corregir error en inicialización
docs(api): actualizar documentación de endpoints
```

## Proceso de Trabajo

### 1. Iniciar Nueva Funcionalidad

```bash
# 1. Asegurarse de estar en develop actualizado
git checkout develop
git pull origin develop

# 2. Crear nueva rama feature
git flow feature start mi-funcionalidad

# 3. Trabajar en la funcionalidad...
```

### 2. Desarrollo y Commits

```bash
# 4. Hacer commits siguiendo las convenciones
git add .
git commit -m "feat(componente): descripción del cambio"

# 5. Mantener la rama actualizada
git fetch origin develop
git rebase origin/develop
```

### 3. Finalizar Funcionalidad

```bash
# 6. Asegurarse que los tests pasan
npm run test

# 7. Finalizar la feature
git flow feature finish mi-funcionalidad
```

## Versionado

Seguimos [Semantic Versioning](https://semver.org/):

- **MAJOR.MINOR.PATCH** (ejemplo: 1.2.3)
  - MAJOR: Cambios incompatibles
  - MINOR: Nuevas funcionalidades compatibles
  - PATCH: Correcciones compatibles

## Etiquetas (Tags)

- Cada versión en `main` debe estar etiquetada
- Formato: `vX.Y.Z` (ejemplo: v1.2.3)
- Se crean automáticamente al finalizar releases

## Reglas de Testing Obligatorio

### Cobertura de Tests

1. **Nuevas Clases**

   - Cada nueva clase debe tener su archivo de test correspondiente
   - Ubicación: `tests/[ruta-correspondiente]/[nombre-clase].test.ts`
   - Cobertura mínima requerida: 80% de las líneas de código
   - Debe incluir tests para:
     - Constructor y propiedades
     - Métodos públicos
     - Casos de error
     - Edge cases

2. **Nuevas Funciones**

   - Toda nueva función debe tener sus tests unitarios
   - Incluir tests para:
     - Casos positivos
     - Casos negativos
     - Valores límite
     - Manejo de errores

3. **Modificaciones a Código Existente**
   - Actualizar los tests existentes
   - Agregar nuevos casos de test para los cambios
   - No reducir la cobertura de tests existente
   - Verificar que los tests anteriores siguen pasando

### Estructura de Tests

```typescript
describe("NombreClase", () => {
  describe("método()", () => {
    it("debería comportarse correctamente en caso normal", () => {
      // Arrange
      // Act
      // Assert
    });

    it("debería manejar casos de error apropiadamente", () => {
      // ...
    });
  });
});
```

### Requerimientos para Pull Requests

- No se aceptarán PR sin tests
- Los tests deben pasar en CI/CD
- Incluir tests de integración cuando sea necesario
- Documentar los casos de prueba complejos

### Comandos de Testing

```bash
# Ejecutar todos los tests
npm run test

# Ejecutar tests con coverage
npm run test:coverage

# Ejecutar tests en modo watch
npm run test:watch

# Ejecutar tests de un archivo específico
npm run test -- path/to/file.test.ts
```

### Buenas Prácticas de Testing

1. **Aislamiento**

   - Usar mocks y stubs apropiadamente
   - Evitar dependencias entre tests
   - Limpiar el estado después de cada test

2. **Nombrado**

   - Tests descriptivos y claros
   - Seguir patrón: "debería [comportamiento esperado] cuando [condición]"
   - Agrupar tests relacionados

3. **Mantenibilidad**
   - DRY en el código de test
   - Usar fixtures y factories
   - Mantener tests simples y enfocados

### Validación en CI/CD

- Los tests son ejecutados automáticamente en cada commit
- Se requiere un mínimo de 80% de cobertura
- Los tests deben completarse en menos de 5 minutos
- No se permiten tests flaky (intermitentes)

## Notas Importantes

1. **Nunca hacer commit directo a main**
2. **Mantener las ramas actualizadas** con sus padres
3. **Probar antes de finalizar** cualquier rama
4. **Documentar cambios significativos**
5. **Revisar conflictos** cuidadosamente

## Comandos Útiles

```bash
# Ver estado del repositorio
git flow status

# Listar features en desarrollo
git flow feature list

# Publicar una feature
git flow feature publish nombre-feature

# Traer una feature publicada
git flow feature pull origin nombre-feature
```

## Gestión de Conflictos

1. Mantener las ramas pequeñas y enfocadas
2. Resolver conflictos en la rama feature/bugfix
3. Usar `git rebase` en lugar de merge cuando sea posible
4. Consultar al equipo ante dudas en resolución
