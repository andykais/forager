import * as events from 'node:events'

export type EmitterEvents = Record<string, {}>
type NodejsEventEmitterTransform<Events extends EmitterEvents> = {
  [Event in keyof Events]: [Events[Event]]
}
export class Emitter<Events extends EmitterEvents = {}> extends events.EventEmitter<NodejsEventEmitterTransform<Events>> {
}

// type FooEvents = {
//   foo: { val: string }
// }
// class Foo extends Emitter<FooEvents> {

// }
// const foo = new Foo()
// foo.emit('foo', { val: 'bar' })
// foo.on('foo', data => {
//   data.val
// })
// foo.removeAllListeners('foo')
