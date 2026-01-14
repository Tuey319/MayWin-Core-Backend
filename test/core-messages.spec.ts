import { WorkerMessagesController } from '../src/core/messages/worker-messages.controller';
import { WorkerMessagesService } from '../src/core/messages/worker-messages.service';

describe('WorkerMessagesController', () => {
  it('should be defined', () => {
    const svc = {} as any;
    const controller = new WorkerMessagesController(svc);
    expect(controller).toBeDefined();
  });
});

describe('WorkerMessagesService', () => {
  it('should be defined', () => {
    const service = new WorkerMessagesService({} as any, {} as any);
    expect(service).toBeDefined();
  });
});
