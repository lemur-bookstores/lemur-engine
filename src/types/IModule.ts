export interface IModule {
  name: string;
  initialize(kernel: any): Promise<void>;
  destroy(): Promise<void>;
  getService?<T>(serviceName: string): T;
}
