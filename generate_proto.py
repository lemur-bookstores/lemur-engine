#!/usr/bin/env python3
"""
Script para generar archivos Python desde Protocol Buffers.
Requiere grpcio-tools instalado: pip install grpcio-tools
"""

import os
import subprocess
import sys
from pathlib import Path


def generate_protobuf_files():
    """Genera archivos Python desde archivos .proto"""
    
    # Directorios
    script_dir = Path(__file__).parent
    proto_dir = script_dir / "src" / "mpc" / "proto"
    output_dir = proto_dir
    
    # Verificar que existe el archivo .proto
    proto_file = proto_dir / "mpc_service.proto"
    if not proto_file.exists():
        print(f"Error: No se encontró {proto_file}")
        return False
    
    # Comando para generar archivos Python
    cmd = [
        sys.executable, "-m", "grpc_tools.protoc",
        f"--proto_path={proto_dir}",
        f"--python_out={output_dir}",
        f"--grpc_python_out={output_dir}",
        str(proto_file)
    ]
    
    print(f"Ejecutando: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print("✅ Archivos Protocol Buffers generados exitosamente")
        
        # Listar archivos generados
        generated_files = [
            output_dir / "mpc_service_pb2.py",
            output_dir / "mpc_service_pb2_grpc.py"
        ]
        
        for file_path in generated_files:
            if file_path.exists():
                print(f"   📄 {file_path}")
            else:
                print(f"   ❌ {file_path} (no generado)")
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Error generando archivos Protocol Buffers:")
        print(f"   Código de salida: {e.returncode}")
        print(f"   Stdout: {e.stdout}")
        print(f"   Stderr: {e.stderr}")
        return False
    except FileNotFoundError:
        print("❌ Error: grpcio-tools no está instalado")
        print("   Instalar con: pip install grpcio-tools")
        return False


def create_init_file():
    """Crea archivo __init__.py en el directorio proto"""
    proto_dir = Path(__file__).parent / "src" / "mpc" / "proto"
    init_file = proto_dir / "__init__.py"
    
    init_content = '''"""
Archivos Protocol Buffers generados para el sistema MPC.
"""

try:
    from .mpc_service_pb2 import *
    from .mpc_service_pb2_grpc import *
    
    __all__ = [
        # Messages
        'MessageRequest', 'MessageResponse', 'MessageEvent',
        'StreamRequest', 'StatsRequest', 'StatsResponse',
        'HealthRequest', 'HealthResponse',
        
        # Enums
        'MessageType', 'ProtocolType',
        
        # Stats
        'ServerStats', 'ProtocolStats', 'PerformanceStats', 'ErrorStats',
        
        # Service
        'MPCServiceServicer', 'MPCServiceStub',
        'add_MPCServiceServicer_to_server'
    ]
    
except ImportError as e:
    print(f"Warning: Could not import generated protobuf files: {e}")
    print("Run 'python generate_proto.py' to generate them.")
    __all__ = []
'''
    
    try:
        with open(init_file, 'w', encoding='utf-8') as f:
            f.write(init_content)
        print(f"✅ Creado {init_file}")
        return True
    except Exception as e:
        print(f"❌ Error creando {init_file}: {e}")
        return False


def main():
    """Función principal"""
    print("🚀 Generando archivos Protocol Buffers para MPC...")
    
    # Crear directorio proto si no existe
    proto_dir = Path(__file__).parent / "src" / "mpc" / "proto"
    proto_dir.mkdir(parents=True, exist_ok=True)
    
    # Crear archivo __init__.py
    create_init_file()
    
    # Generar archivos protobuf
    success = generate_protobuf_files()
    
    if success:
        print("\n✅ Generación completada exitosamente")
        print("\n📋 Próximos pasos:")
        print("   1. Verificar que los archivos se generaron correctamente")
        print("   2. Actualizar las importaciones en grpc_adapter.py")
        print("   3. Ejecutar las pruebas del adaptador gRPC")
    else:
        print("\n❌ Error en la generación")
        print("\n🔧 Soluciones:")
        print("   1. Instalar grpcio-tools: pip install grpcio-tools")
        print("   2. Verificar que el archivo .proto existe")
        print("   3. Verificar permisos de escritura")


if __name__ == "__main__":
    main()