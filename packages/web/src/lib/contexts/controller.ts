import { createContext } from 'svelte'
import type { BaseController } from '$lib/base_controller.ts'

const [get_controller_context, set_controller_context] = createContext<BaseController>()

/**
 * Store the route's controller in component context so descendants can read it
 * without prop drilling. Returns the controller for ergonomic assignment.
 */
function set_controller<T extends BaseController>(controller: T): T {
  set_controller_context(controller)
  return controller
}

/**
 * Read the controller provided by an ancestor via {@link set_controller}. Pass
 * the concrete controller type for the current route to narrow the return type.
 */
function get_controller<T extends BaseController = BaseController>(): T {
  return get_controller_context() as T
}

export { set_controller, get_controller }
