"""
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