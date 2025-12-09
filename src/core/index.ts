/**
 * @struktos/core - Core Module
 * 
 * Core context propagation and management
 */

export { IContext, StruktosContextData, StruktosContext } from './IContext';
export { 
  RequestContext, 
  getCurrentContext, 
  tryGetCurrentContext,
  RequireContext 
} from './RequestContext';