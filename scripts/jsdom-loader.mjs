export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@react-three/fiber') {
    return { url: 'jsdom:react-three-fiber', shortCircuit: true };
  }
  if (specifier === '@react-three/drei') {
    return { url: 'jsdom:react-three-drei', shortCircuit: true };
  }
  if (specifier === 'react/jsx-runtime' || specifier === 'react/jsx-dev-runtime') {
    return { url: 'jsdom:react-jsx-runtime', shortCircuit: true };
  }

  if (context.parentURL?.startsWith('jsdom:')) {
    return nextResolve(specifier, {
      ...context,
      parentURL: new URL('../', import.meta.url).href,
    });
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === 'jsdom:react-three-fiber') {
    return {
      format: 'module',
      source: `
        import React, { createContext, useContext, useEffect, useLayoutEffect, useRef } from 'react';
        import * as THREE from 'three';

        const context = createContext(null);

        export function Canvas({ children, onCreated }) {
          const canvasRef = useRef(null);
          const stateRef = useRef(null);
          const createdRef = useRef(false);
          if (stateRef.current === null) {
            const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
            const controls = {
              enabled: true,
              target: new THREE.Vector3(),
              update() {},
              saveState() {},
              reset() {},
            };
            const domElementRef = { current: null };
            const gl = {};
            Object.defineProperty(gl, 'domElement', {
              configurable: true,
              get() { return domElementRef.current ?? document.querySelector('canvas'); },
              set(value) { domElementRef.current = value; },
            });
            stateRef.current = {
              gl,
              camera,
              controls,
              size: { width: 1440, height: 900, top: 0, left: 0 },
              viewport: { width: 1440, height: 900, factor: 1, distance: 1, aspect: 1 },
              clock: { elapsedTime: 0, getElapsedTime() { return this.elapsedTime; } },
              frames: new Set(),
            };
          }
          const state = stateRef.current;
          useLayoutEffect(() => {
            state.gl.domElement = canvasRef.current;
            if (!createdRef.current) {
              createdRef.current = true;
              onCreated?.(state);
            }
          }, [state, onCreated]);
          useEffect(() => {
            const timer = setInterval(() => {
              const delta = 0.016;
              state.clock.elapsedTime += delta;
              for (const callback of [...state.frames]) {
                try { callback(state, delta); } catch (error) { console.error(error); }
              }
            }, 16);
            return () => clearInterval(timer);
          }, [state]);
          const attachCanvas = (node) => {
            canvasRef.current = node;
            if (node !== null) state.gl.domElement = node;
          };
          return React.createElement(
            context.Provider,
            { value: state },
            React.createElement('canvas', { ref: attachCanvas }, children),
          );
        }

        export function useThree(selector) {
          const state = useContext(context);
          if (state === null) throw new Error('useThree called outside DOM Canvas');
          return typeof selector === 'function' ? selector(state) : state;
        }

        export function useFrame(callback) {
          const state = useContext(context);
          if (state === null) throw new Error('useFrame called outside DOM Canvas');
          const callbackRef = useRef(callback);
          callbackRef.current = callback;
          useEffect(() => {
            const wrapped = (nextState, delta) => callbackRef.current(nextState, delta);
            state.frames.add(wrapped);
            return () => state.frames.delete(wrapped);
          }, [state]);
        }

        export function extend() {}
      `,
      shortCircuit: true,
    };
  }

  if (url === 'jsdom:react-three-drei') {
    return {
      format: 'module',
      source: `
        import React, { forwardRef, useImperativeHandle } from 'react';
        import * as THREE from 'three';

        const childrenOnly = ({ children }) => children ?? null;
        export const Html = childrenOnly;
        export const Billboard = childrenOnly;
        export const Line = () => null;
        export const Text = () => null;
        export const Stars = () => null;
        const gltfScene = new THREE.Group();
        export const useGLTF = Object.assign(() => ({ scene: gltfScene }), { preload() {} });
        export const useTexture = Object.assign(() => null, { preload() {} });
        export const PerspectiveCamera = () => null;
        export const OrbitControls = forwardRef((props, ref) => {
          const controls = {
            enabled: true,
            target: {
              x: 0, y: 0, z: 0,
              set(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; return this; },
              clone() { return { x: this.x, y: this.y, z: this.z, copy() {}, sub() {}, lerpVectors() {} }; },
              copy() { return this; },
              sub() { return this; },
              lerpVectors() { return this; },
            },
            update() {},
            saveState() {},
            reset() {},
          };
          useImperativeHandle(ref, () => controls, []);
          return null;
        });
      `,
      shortCircuit: true,
    };
  }

  if (url === 'jsdom:react-jsx-runtime') {
    return {
      format: 'module',
      source: `
        import React, { forwardRef, useImperativeHandle, useMemo } from 'react';

        const R3F_TAGS = new Set([
          'group', 'mesh', 'instancedMesh', 'primitive', 'points', 'line', 'lineSegments', 'sprite',
          'hemisphereLight', 'ambientLight', 'directionalLight', 'pointLight', 'spotLight',
          'meshBasicMaterial', 'meshStandardMaterial', 'meshPhysicalMaterial', 'shaderMaterial',
          'pointsMaterial', 'lineBasicMaterial', 'bufferGeometry', 'bufferAttribute',
          'instancedBufferGeometry', 'instancedBufferAttribute', 'sphereGeometry', 'planeGeometry',
          'cylinderGeometry', 'coneGeometry', 'boxGeometry', 'ringGeometry', 'shapeGeometry',
          'torusGeometry', 'circleGeometry', 'dodecahedronGeometry', 'icosahedronGeometry',
          'capsuleGeometry', 'fog',
        ]);

        const vector = () => ({
          x: 0, y: 0, z: 0,
          set(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; return this; },
          copy(other) { this.x = other.x; this.y = other.y; this.z = other.z; return this; },
          clone() { return vector().set(this.x, this.y, this.z); },
          sub() { return this; },
          lerpVectors() { return this; },
          lerp() { return this; },
          setScalar(value = 0) { this.x = value; this.y = value; this.z = value; return this; },
        });

        function mockObject(type, source) {
          if (type === 'primitive' && source) return source;
          const geometry = {
            attributes: {},
            getAttribute() { return { count: 0, array: [] }; },
            setDrawRange() {},
            setAttribute() { return this; },
            computeBoundingSphere() {},
          };
          const instanceColor = {
            needsUpdate: false,
            getX() { return 0; },
            getY() { return 0; },
            getZ() { return 0; },
            getW() { return 0; },
          };
          return {
            isMesh: type === 'mesh' || type === 'instancedMesh',
            visible: true,
            count: 0,
            geometry,
            material: { color: { set() {} } },
            instanceMatrix: { needsUpdate: false },
            instanceColor,
            matrix: { copy() { return this; } },
            position: vector(),
            rotation: vector(),
            scale: vector().set(1, 1, 1),
            traverse(visitor) { visitor(this); },
            setMatrixAt() {},
            setColorAt() {},
            updateMatrix() {},
            getAttribute() { return { count: 0, array: [] }; },
            setAttribute() { return this; },
            computeBoundingSphere() {},
          };
        }

        const Host = forwardRef((props, ref) => {
          const object = useMemo(
            () => mockObject(props.__r3fType, props.object),
            [props.__r3fType, props.object],
          );
          useImperativeHandle(ref, () => object, [object]);
          return props.children ?? null;
        });

        function create(type, props, key) {
          const nextProps = props == null ? {} : { ...props };
          if (key !== undefined) nextProps.key = key;
          if (typeof type === 'string' && R3F_TAGS.has(type)) {
            return React.createElement(Host, { ...nextProps, __r3fType: type });
          }
          return React.createElement(type, nextProps);
        }

        export const Fragment = React.Fragment;
        export const jsx = create;
        export const jsxs = create;
        export const jsxDEV = create;
      `,
      shortCircuit: true,
    };
  }

  if (url.endsWith('.scss') || url.endsWith('.css')) {
    return {
      format: 'module',
      source: 'export default {};',
      shortCircuit: true,
    };
  }

  return nextLoad(url, context);
}
