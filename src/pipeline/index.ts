/**
 * @struktos/core - Pipeline Module
 * 
 * Middleware pipeline utilities and composition
 */

export {
  PipelineBuilder,
  createPipeline,
  compose,
  branch,
  forMethods,
  forPaths,
  wrapErrors,
  parallel,
  withRetry,
  withTimeout,
} from './builder';