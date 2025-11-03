import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import * as THREE from 'three';

interface Door3DProps {
  isOpen: boolean;
  isFullyOpen: boolean;
  isVisible: boolean;
}

function Door3DModel({ isOpen, isFullyOpen, isVisible }: Door3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const doorRef = useRef<THREE.Group>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);
  
  useEffect(() => {
    // Load MTL first, then OBJ
    const mtlLoader = new MTLLoader();
    const objLoader = new OBJLoader();
    
    mtlLoader.load(
      '/assets/doors/Low Poly Door/Low Poly Door.mtl',
      (materials) => {
        materials.preload();
        objLoader.setMaterials(materials);
        
        objLoader.load(
          '/assets/doors/Low Poly Door/Low Poly Door.obj',
          (object) => {
            // Set white material
            object.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.material = new THREE.MeshStandardMaterial({ 
                  color: '#ffffff',
                  metalness: 0.1,
                  roughness: 0.8
                });
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            
            // Separate door (Body_Cube) from frame (everything else)
            const frameGroup = new THREE.Group();
            const doorGroup = new THREE.Group();
            let doorMesh: THREE.Object3D | null = null;
            
            // Find door by name or by size
            // OBJLoader creates groups for each 'o' object
            object.children.forEach((child) => {
              // Check name - door is "Body_Cube"
              if (child.name === 'Body_Cube' || 
                  (child.name && child.name.toLowerCase().includes('body'))) {
                doorMesh = child;
                doorGroup.add(child);
              } else {
                // Everything else is frame
                frameGroup.add(child);
              }
            });
            
            // If not found by name, find largest mesh (the door body is the biggest)
            if (!doorMesh || doorGroup.children.length === 0) {
              let maxSize = 0;
              
              object.children.forEach((child) => {
                if (child instanceof THREE.Group) {
                  child.traverse((mesh) => {
                    if (mesh instanceof THREE.Mesh) {
                      mesh.geometry.computeBoundingBox();
                      const size = mesh.geometry.boundingBox!.getSize(new THREE.Vector3());
                      const sizeLength = size.length();
                      if (sizeLength > maxSize) {
                        maxSize = sizeLength;
                        doorMesh = child;
                      }
                    }
                  });
                }
              });
              
              // Re-separate based on largest
              frameGroup.clear();
              doorGroup.clear();
              object.children.forEach((child) => {
                if (child === doorMesh) {
                  doorGroup.add(child);
                } else {
                  frameGroup.add(child);
                }
              });
            }
            
            // Combine frame and door into main group
            const mainGroup = new THREE.Group();
            mainGroup.add(frameGroup);
            mainGroup.add(doorGroup);
            
            // Rotate entire model -90 degrees to face the camera (from side to front)
            // The model is likely exported sideways, so rotate to face forward (-Z axis toward camera)
            mainGroup.rotation.y = -Math.PI / 2;
            
            // Compute bounding box and scale
            const box = new THREE.Box3().setFromObject(mainGroup);
            const size = box.getSize(new THREE.Vector3());
            
            // Scale to fit (height ~2.8 units)
            const scale = 2.8 / size.y;
            mainGroup.scale.set(scale, scale, scale);
            
            // Center horizontally, align bottom
            box.setFromObject(mainGroup);
            const center = box.getCenter(new THREE.Vector3());
            mainGroup.position.set(-center.x, -box.min.y, 0);
            
            // Set pivot point for door rotation to left edge
            if (doorMesh) {
              // Calculate pivot after rotation - need to account for the 90 degree rotation
              // The door should rotate around its left edge, which after rotation is at min.z
              const doorBox = new THREE.Box3().setFromObject(doorGroup);
              const pivotZ = doorBox.min.z;
              
              // Adjust door position so it rotates around its left edge
              doorGroup.position.z -= pivotZ;
              
              // Store door group for rotation
              doorRef.current = doorGroup;
            }
            
            setModel(mainGroup);
          },
          undefined,
          (error) => {
            console.error('Error loading OBJ:', error);
          }
        );
      },
      undefined,
      (error) => {
        console.error('Error loading MTL:', error);
        // Try loading OBJ without MTL
        objLoader.load(
          '/assets/doors/Low Poly Door/Low Poly Door.obj',
          (object) => {
            object.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.material = new THREE.MeshStandardMaterial({ 
                  color: '#ffffff',
                  metalness: 0.1,
                  roughness: 0.8
                });
              }
            });
            setModel(object);
          }
        );
      }
    );
  }, []);
  
  useEffect(() => {
    if (model && groupRef.current) {
      // Clear existing children
      while (groupRef.current.children.length > 0) {
        groupRef.current.remove(groupRef.current.children[0]);
      }
      // Add model
      groupRef.current.add(model.clone());
    }
  }, [model]);
  
  // Animate door opening
  useFrame(() => {
    if (doorRef.current) {
      let targetRotation = 0;
      
      if (isFullyOpen) {
        targetRotation = -Math.PI / 2; // -90 degrees
      } else if (isOpen) {
        targetRotation = -Math.PI / 6; // -30 degrees (cracked)
      }
      
      // Smooth rotation with easing
      // Rotate around Y axis (vertical) after the model has been rotated to face front
      const rotationSpeed = 0.08;
      doorRef.current.rotation.y += (targetRotation - doorRef.current.rotation.y) * rotationSpeed;
    }
  });
  
  if (!isVisible || !model) {
    return null;
  }
  
  return (
    <>
      <primitive object={model} ref={groupRef} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 5, 5]} intensity={0.5} />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />
    </>
  );
}

export default Door3DModel;

