# Implementación de búsqueda de configuración con findUp

## Cambios realizados

### 1. ConfigLoader (src/core/config/ConfigLoader.ts)

**Antes:**

- Utilizaba rutas estáticas predefinidas (`CONFIG_PATHS`) para buscar archivos de configuración
- Buscaba en rutas relativas como `./kernel.config.json`, `./config/kernel.json`, etc.

**Después:**

- Utiliza la utilidad `findUp` para buscar `kernel.config.json` de forma ascendente
- Comienza la búsqueda desde el directorio `src` y busca hacia arriba hasta encontrar el archivo
- El archivo `kernel.config.json` debe estar ubicado al nivel de `src` o superior

**Beneficios:**

- Búsqueda más flexible y robusta
- No depende de rutas relativas específicas
- Encuentra el archivo independientemente de desde dónde se ejecute el código

### 2. PluginLoader (src/core/plugins/PluginLoader.ts)

**Antes:**

- Buscaba `plugin.json` únicamente en el directorio raíz de cada plugin
- Utilizaba `path.join(pluginPath, 'plugin.json')` directamente

**Después:**

- Utiliza `findUp` para buscar `plugin.json` de forma ascendente desde el directorio del plugin
- Permite que el archivo `plugin.json` esté en cualquier nivel de la jerarquía del plugin
- Calcula la ruta de entrada del plugin relative al directorio donde se encuentra `plugin.json`

**Beneficios:**

- Mayor flexibilidad en la estructura de directorios de plugins
- Permite plugins con estructuras más complejas
- Encuentra automáticamente la configuración del plugin

### 3. Utilidad findUp (src/utils/index.ts)

La función `findUp` implementa un algoritmo de búsqueda ascendente que:

1. Comienza desde un directorio dado (`cwd`)
2. Busca el archivo/directorio especificado (`name`)
3. Si no lo encuentra, sube un nivel en la jerarquía
4. Repite hasta encontrar el archivo o llegar a la raíz del sistema
5. Retorna la ruta absoluta del archivo encontrado o `null` si no existe

**Características:**

- Manejo robusto de errores
- Búsqueda eficiente con terminación garantizada
- Compatible con diferentes sistemas operativos

## Estructura esperada

### Configuración del Kernel

```
proyecto/
├── src/
│   └── core/
│       └── config/
│           └── ConfigLoader.ts
└── kernel.config.json  ← Debe estar aquí o en nivel superior
```

### Configuración de Plugins

```
plugins/
├── cache-plugin/
│   ├── plugin.json     ← Archivo de configuración del plugin
│   ├── index.ts        ← Archivo de entrada especificado en plugin.json
│   └── ...
└── otro-plugin/
    ├── plugin.json
    ├── main.js
    └── ...
```

## Verificación

Se han realizado pruebas exitosas que confirman:

✅ `kernel.config.json` se encuentra correctamente desde el directorio `src`
✅ `plugin.json` se encuentra correctamente para cada plugin
✅ No hay errores de compilación en los archivos modificados
✅ La funcionalidad es compatible con la estructura existente del proyecto

## Archivos modificados

1. `src/core/config/ConfigLoader.ts` - Implementación de búsqueda con findUp para kernel.config.json
2. `src/core/plugins/PluginLoader.ts` - Implementación de búsqueda con findUp para plugin.json
3. `plugins/cache-plugin/plugin.json` - Añadido campo `entry` requerido por PluginLoader
