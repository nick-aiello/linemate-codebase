import { handleRequest } from './routes/index.js';

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  }
};
