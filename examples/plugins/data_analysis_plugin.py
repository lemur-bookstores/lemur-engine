"""
Plugin de ejemplo: Análisis de Datos
Este plugin demuestra capacidades avanzadas de procesamiento y análisis de datos
"""

import json
import statistics
from datetime import datetime, timedelta
from typing import Dict, Any, List, Union
from dataclasses import dataclass, field
import re

from src.mcp.core.resource_manager import MCPTool, MCPPlugin

@dataclass
class DataAnalysisPlugin(MCPPlugin):
    """Plugin para análisis de datos y estadísticas"""
    
    name: str = "data_analysis"
    version: str = "1.0.0"
    description: str = "Plugin para análisis estadístico y procesamiento de datos"
    author: str = "MCP Analytics Team"
    
    def __post_init__(self):
        self.datasets: Dict[str, List[Dict]] = {}
        self.analysis_cache: Dict[str, Dict] = {}
    
    def get_tools(self) -> List[MCPTool]:
        return [
            MCPTool(
                name="cargar_dataset",
                description="Carga un dataset desde datos JSON",
                parameters={
                    "name": {
                        "type": "string",
                        "description": "Nombre del dataset",
                        "required": True
                    },
                    "data": {
                        "type": "array",
                        "description": "Array de objetos con los datos",
                        "required": True
                    }
                },
                handler=self.cargar_dataset
            ),
            MCPTool(
                name="generar_dataset_ejemplo",
                description="Genera un dataset de ejemplo para pruebas",
                parameters={
                    "type": {
                        "type": "string",
                        "description": "Tipo de dataset (sales, users, metrics)",
                        "required": True
                    },
                    "size": {
                        "type": "number",
                        "description": "Número de registros",
                        "required": False,
                        "default": 100
                    }
                },
                handler=self.generar_dataset_ejemplo
            ),
            MCPTool(
                name="analisis_estadistico",
                description="Realiza análisis estadístico básico de un dataset",
                parameters={
                    "dataset_name": {
                        "type": "string",
                        "description": "Nombre del dataset",
                        "required": True
                    },
                    "column": {
                        "type": "string",
                        "description": "Columna numérica a analizar",
                        "required": True
                    }
                },
                handler=self.analisis_estadistico
            ),
            MCPTool(
                name="filtrar_datos",
                description="Filtra datos según criterios específicos",
                parameters={
                    "dataset_name": {
                        "type": "string",
                        "description": "Nombre del dataset",
                        "required": True
                    },
                    "filters": {
                        "type": "object",
                        "description": "Filtros a aplicar (campo: valor)",
                        "required": True
                    }
                },
                handler=self.filtrar_datos
            ),
            MCPTool(
                name="agrupar_datos",
                description="Agrupa datos por una columna y calcula métricas",
                parameters={
                    "dataset_name": {
                        "type": "string",
                        "description": "Nombre del dataset",
                        "required": True
                    },
                    "group_by": {
                        "type": "string",
                        "description": "Campo por el cual agrupar",
                        "required": True
                    },
                    "metric_column": {
                        "type": "string",
                        "description": "Columna numérica para calcular métricas",
                        "required": True
                    },
                    "operation": {
                        "type": "string",
                        "description": "Operación (sum, avg, count, min, max)",
                        "required": False,
                        "default": "sum"
                    }
                },
                handler=self.agrupar_datos
            ),
            MCPTool(
                name="detectar_anomalias",
                description="Detecta valores anómalos en una columna numérica",
                parameters={
                    "dataset_name": {
                        "type": "string",
                        "description": "Nombre del dataset",
                        "required": True
                    },
                    "column": {
                        "type": "string",
                        "description": "Columna numérica a analizar",
                        "required": True
                    },
                    "method": {
                        "type": "string",
                        "description": "Método de detección (iqr, zscore)",
                        "required": False,
                        "default": "iqr"
                    }
                },
                handler=self.detectar_anomalias
            ),
            MCPTool(
                name="generar_reporte",
                description="Genera un reporte completo del dataset",
                parameters={
                    "dataset_name": {
                        "type": "string",
                        "description": "Nombre del dataset",
                        "required": True
                    }
                },
                handler=self.generar_reporte
            ),
            MCPTool(
                name="listar_datasets",
                description="Lista todos los datasets cargados",
                parameters={},
                handler=self.listar_datasets
            )
        ]
    
    async def cargar_dataset(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Carga un dataset desde datos JSON"""
        name = arguments.get("name")
        data = arguments.get("data")
        
        if not isinstance(data, list):
            return {
                "success": False,
                "error": "Los datos deben ser un array de objetos"
            }
        
        if not data:
            return {
                "success": False,
                "error": "El dataset no puede estar vacío"
            }
        
        self.datasets[name] = data
        
        # Limpiar caché relacionado
        self.analysis_cache = {k: v for k, v in self.analysis_cache.items() if not k.startswith(f"{name}_")}
        
        return {
            "success": True,
            "message": f"Dataset '{name}' cargado exitosamente",
            "records": len(data),
            "columns": list(data[0].keys()) if data else []
        }
    
    async def generar_dataset_ejemplo(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Genera un dataset de ejemplo"""
        dataset_type = arguments.get("type")
        size = arguments.get("size", 100)
        
        import random
        from datetime import datetime, timedelta
        
        if dataset_type == "sales":
            data = []
            products = ["Laptop", "Mouse", "Keyboard", "Monitor", "Tablet"]
            regions = ["North", "South", "East", "West"]
            
            for i in range(size):
                date = datetime.now() - timedelta(days=random.randint(0, 365))
                data.append({
                    "id": i + 1,
                    "product": random.choice(products),
                    "region": random.choice(regions),
                    "sales": round(random.uniform(100, 5000), 2),
                    "quantity": random.randint(1, 50),
                    "date": date.strftime("%Y-%m-%d"),
                    "salesperson": f"Vendedor_{random.randint(1, 20)}"
                })
        
        elif dataset_type == "users":
            data = []
            domains = ["gmail.com", "yahoo.com", "hotmail.com", "company.com"]
            
            for i in range(size):
                age = random.randint(18, 70)
                data.append({
                    "id": i + 1,
                    "name": f"Usuario_{i+1}",
                    "email": f"user{i+1}@{random.choice(domains)}",
                    "age": age,
                    "score": random.randint(0, 100),
                    "active": random.choice([True, False]),
                    "registration_date": (datetime.now() - timedelta(days=random.randint(0, 1000))).strftime("%Y-%m-%d")
                })
        
        elif dataset_type == "metrics":
            data = []
            for i in range(size):
                data.append({
                    "timestamp": (datetime.now() - timedelta(hours=i)).isoformat(),
                    "cpu_usage": round(random.uniform(0, 100), 2),
                    "memory_usage": round(random.uniform(0, 100), 2),
                    "disk_usage": round(random.uniform(0, 100), 2),
                    "network_in": random.randint(0, 1000),
                    "network_out": random.randint(0, 1000),
                    "server": f"server_{random.randint(1, 5)}"
                })
        
        else:
            return {
                "success": False,
                "error": "Tipo de dataset no soportado. Opciones: sales, users, metrics"
            }
        
        dataset_name = f"{dataset_type}_example"
        self.datasets[dataset_name] = data
        
        return {
            "success": True,
            "dataset_name": dataset_name,
            "message": f"Dataset de ejemplo '{dataset_name}' generado",
            "records": len(data),
            "columns": list(data[0].keys())
        }
    
    async def analisis_estadistico(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Realiza análisis estadístico básico"""
        dataset_name = arguments.get("dataset_name")
        column = arguments.get("column")
        
        if dataset_name not in self.datasets:
            return {"success": False, "error": "Dataset no encontrado"}
        
        data = self.datasets[dataset_name]
        
        # Extraer valores numéricos de la columna
        values = []
        for row in data:
            if column in row:
                try:
                    value = float(row[column])
                    values.append(value)
                except (ValueError, TypeError):
                    continue
        
        if not values:
            return {
                "success": False,
                "error": f"No se encontraron valores numéricos en la columna '{column}'"
            }
        
        try:
            stats = {
                "count": len(values),
                "mean": statistics.mean(values),
                "median": statistics.median(values),
                "mode": statistics.mode(values) if len(set(values)) < len(values) else None,
                "std_dev": statistics.stdev(values) if len(values) > 1 else 0,
                "variance": statistics.variance(values) if len(values) > 1 else 0,
                "min": min(values),
                "max": max(values),
                "range": max(values) - min(values),
                "q1": statistics.quantiles(values, n=4)[0] if len(values) >= 4 else None,
                "q3": statistics.quantiles(values, n=4)[2] if len(values) >= 4 else None
            }
            
            return {
                "success": True,
                "column": column,
                "statistics": stats
            }
        
        except Exception as e:
            return {
                "success": False,
                "error": f"Error calculando estadísticas: {str(e)}"
            }
    
    async def filtrar_datos(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Filtra datos según criterios"""
        dataset_name = arguments.get("dataset_name")
        filters = arguments.get("filters", {})
        
        if dataset_name not in self.datasets:
            return {"success": False, "error": "Dataset no encontrado"}
        
        data = self.datasets[dataset_name]
        filtered_data = []
        
        for row in data:
            match = True
            for field, value in filters.items():
                if field not in row:
                    match = False
                    break
                
                # Comparación flexible
                if isinstance(value, str) and isinstance(row[field], str):
                    if value.lower() not in row[field].lower():
                        match = False
                        break
                elif row[field] != value:
                    match = False
                    break
            
            if match:
                filtered_data.append(row)
        
        return {
            "success": True,
            "original_count": len(data),
            "filtered_count": len(filtered_data),
            "data": filtered_data[:100],  # Limitar a 100 registros
            "showing": min(100, len(filtered_data))
        }
    
    async def agrupar_datos(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Agrupa datos y calcula métricas"""
        dataset_name = arguments.get("dataset_name")
        group_by = arguments.get("group_by")
        metric_column = arguments.get("metric_column")
        operation = arguments.get("operation", "sum")
        
        if dataset_name not in self.datasets:
            return {"success": False, "error": "Dataset no encontrado"}
        
        data = self.datasets[dataset_name]
        groups = {}
        
        # Agrupar datos
        for row in data:
            if group_by not in row or metric_column not in row:
                continue
            
            group_key = str(row[group_by])
            if group_key not in groups:
                groups[group_key] = []
            
            try:
                value = float(row[metric_column])
                groups[group_key].append(value)
            except (ValueError, TypeError):
                continue
        
        # Calcular métricas
        results = {}
        for group, values in groups.items():
            if not values:
                continue
            
            if operation == "sum":
                result = sum(values)
            elif operation == "avg":
                result = statistics.mean(values)
            elif operation == "count":
                result = len(values)
            elif operation == "min":
                result = min(values)
            elif operation == "max":
                result = max(values)
            else:
                return {"success": False, "error": f"Operación '{operation}' no soportada"}
            
            results[group] = {
                "value": result,
                "count": len(values)
            }
        
        return {
            "success": True,
            "group_by": group_by,
            "metric_column": metric_column,
            "operation": operation,
            "groups": results
        }
    
    async def detectar_anomalias(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Detecta anomalías en los datos"""
        dataset_name = arguments.get("dataset_name")
        column = arguments.get("column")
        method = arguments.get("method", "iqr")
        
        if dataset_name not in self.datasets:
            return {"success": False, "error": "Dataset no encontrado"}
        
        data = self.datasets[dataset_name]
        values = []
        indices = []
        
        for i, row in enumerate(data):
            if column in row:
                try:
                    value = float(row[column])
                    values.append(value)
                    indices.append(i)
                except (ValueError, TypeError):
                    continue
        
        if len(values) < 4:
            return {
                "success": False,
                "error": "Se necesitan al menos 4 valores para detectar anomalías"
            }
        
        anomalies = []
        
        if method == "iqr":
            q1 = statistics.quantiles(values, n=4)[0]
            q3 = statistics.quantiles(values, n=4)[2]
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            
            for i, value in enumerate(values):
                if value < lower_bound or value > upper_bound:
                    anomalies.append({
                        "index": indices[i],
                        "value": value,
                        "type": "outlier_iqr",
                        "bounds": {"lower": lower_bound, "upper": upper_bound}
                    })
        
        elif method == "zscore":
            mean = statistics.mean(values)
            std_dev = statistics.stdev(values)
            threshold = 2.5  # Z-score threshold
            
            for i, value in enumerate(values):
                z_score = abs((value - mean) / std_dev) if std_dev > 0 else 0
                if z_score > threshold:
                    anomalies.append({
                        "index": indices[i],
                        "value": value,
                        "z_score": z_score,
                        "type": "outlier_zscore"
                    })
        
        return {
            "success": True,
            "method": method,
            "total_values": len(values),
            "anomalies_found": len(anomalies),
            "anomalies": anomalies
        }
    
    async def generar_reporte(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Genera un reporte completo del dataset"""
        dataset_name = arguments.get("dataset_name")
        
        if dataset_name not in self.datasets:
            return {"success": False, "error": "Dataset no encontrado"}
        
        data = self.datasets[dataset_name]
        
        if not data:
            return {"success": False, "error": "Dataset vacío"}
        
        # Información básica
        total_records = len(data)
        columns = list(data[0].keys())
        
        # Análisis por columna
        column_analysis = {}
        for column in columns:
            values = [row.get(column) for row in data if column in row]
            non_null_values = [v for v in values if v is not None]
            
            analysis = {
                "total_values": len(values),
                "non_null_values": len(non_null_values),
                "null_percentage": ((len(values) - len(non_null_values)) / len(values) * 100) if values else 0,
                "unique_values": len(set(str(v) for v in non_null_values)),
                "data_type": "mixed"
            }
            
            # Detectar tipo de datos predominante
            numeric_count = 0
            for v in non_null_values[:100]:  # Muestra de 100 valores
                try:
                    float(v)
                    numeric_count += 1
                except (ValueError, TypeError):
                    pass
            
            if numeric_count > len(non_null_values) * 0.8:
                analysis["data_type"] = "numeric"
                # Estadísticas para columnas numéricas
                numeric_values = []
                for v in non_null_values:
                    try:
                        numeric_values.append(float(v))
                    except (ValueError, TypeError):
                        pass
                
                if numeric_values:
                    analysis["statistics"] = {
                        "mean": statistics.mean(numeric_values),
                        "median": statistics.median(numeric_values),
                        "min": min(numeric_values),
                        "max": max(numeric_values),
                        "std_dev": statistics.stdev(numeric_values) if len(numeric_values) > 1 else 0
                    }
            else:
                analysis["data_type"] = "categorical"
                # Top valores para columnas categóricas
                value_counts = {}
                for v in non_null_values:
                    str_v = str(v)
                    value_counts[str_v] = value_counts.get(str_v, 0) + 1
                
                top_values = sorted(value_counts.items(), key=lambda x: x[1], reverse=True)[:5]
                analysis["top_values"] = top_values
            
            column_analysis[column] = analysis
        
        return {
            "success": True,
            "dataset_name": dataset_name,
            "report": {
                "basic_info": {
                    "total_records": total_records,
                    "total_columns": len(columns),
                    "columns": columns
                },
                "column_analysis": column_analysis,
                "generated_at": datetime.now().isoformat()
            }
        }
    
    async def listar_datasets(self, tool: MCPTool, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Lista todos los datasets cargados"""
        datasets_info = {}
        
        for name, data in self.datasets.items():
            datasets_info[name] = {
                "records": len(data),
                "columns": list(data[0].keys()) if data else [],
                "size_mb": len(str(data)) / (1024 * 1024)
            }
        
        return {
            "success": True,
            "total_datasets": len(self.datasets),
            "datasets": datasets_info
        }
    
    async def initialize(self) -> bool:
        """Inicializa el plugin"""
        print(f"📊 Inicializando {self.name} v{self.version}")
        return True
    
    async def shutdown(self) -> bool:
        """Cierra el plugin"""
        print(f"📊 Cerrando {self.name}")
        self.datasets.clear()
        self.analysis_cache.clear()
        return True

def create_plugin() -> MCPPlugin:
    """Función requerida para crear instancia del plugin"""
    return DataAnalysisPlugin()