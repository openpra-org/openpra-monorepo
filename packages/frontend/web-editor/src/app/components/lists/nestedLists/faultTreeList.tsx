import { UseGlobalStore } from "../../../zustand/Store";
import { NestedModelListZustand } from "./templateList/nestedModelListZustand";
import { FaultTreeListZustand } from "./FaultTreeListZustand";
import { useState, useEffect } from "react";
import { 
  getFaultTrees,
  getFaultTree,
  createFaultTree, 
  updateFaultTreeMetadata, 
  deleteFaultTree 
} from "shared-types/src/lib/api/NestedModelsAPI/FaultTreesApiManager";
import type { FaultTree } from "shared-types/src/lib/api/NestedModelsAPI/FaultTreesApiManager";
import { UseToastContext } from "../../../providers/toastProvider";
import { allToasts } from "../../../../utils/faultTreeData";
import { GenerateUUID } from "../../../../utils/treeUtils";

function FaultTreeList(): JSX.Element {
  const { addToast } = UseToastContext();
  const currentModel = UseGlobalStore.use.currentModel();
  const [faultTrees, setFaultTrees] = useState<FaultTree[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFaultTrees = async () => {
      if (!currentModel?.id) return;
      
      try {
        const trees = await getFaultTrees(currentModel.id);
        setFaultTrees(trees);
      } catch (error) {
        console.error("Failed to load fault trees:", error);
        addToast({ 
          id: GenerateUUID(), 
          ...allToasts.find(t => t.type === "error")! 
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadFaultTrees();
  }, [currentModel?.id, addToast]);

  const getFaultTreeHandler = async (id: string): Promise<void> => {
    try {
      const tree = await getFaultTree(id);
      // Update the specific tree in the list
      setFaultTrees(prev => 
        prev.map(t => t.id === id ? tree : t)
      );
    } catch (error) {
      console.error("Failed to fetch fault tree:", error);
      addToast({ 
        id: GenerateUUID(), 
        ...allToasts.find(t => t.type === "error")! 
      });
    }
  };

  const addFaultTreeHandler = async (data: Omit<FaultTree, 'id'>) => {
    if (!currentModel?.id) return;
    
    try {
      const newTree = await createFaultTree(data);
      setFaultTrees(prev => [...prev, newTree]);
      addToast({ 
        id: GenerateUUID(), 
        ...allToasts.find(t => t.type === "success")! 
      });
    } catch (error) {
      console.error("Failed to create fault tree:", error);
      addToast({ 
        id: GenerateUUID(), 
        ...allToasts.find(t => t.type === "error")!
      });
    }
  };

  const editFaultTreeHandler = async (id: string, data: Partial<FaultTree>) => {
    try {
      const updatedTree = await updateFaultTreeMetadata(id, data);
      setFaultTrees(prev => 
        prev.map(tree => tree.id === id ? updatedTree : tree)
      );
      addToast({ 
        id: GenerateUUID(), 
        ...allToasts.find(t => t.type === "success")! 
      });
    } catch (error) {
      console.error("Failed to update fault tree:", error);
      addToast({ 
        id: GenerateUUID(), 
        ...allToasts.find(t => t.type === "error")! 
      });
    }
  };

  const deleteFaultTreeHandler = async (id: string) => {
    if (!currentModel?.id) return;
    
    try {
      await deleteFaultTree(id);
      setFaultTrees(prev => prev.filter(tree => tree.id !== id));
      addToast({ 
        id: GenerateUUID(), 
        ...allToasts.find(t => t.type === "success")! 
      });
    } catch (error) {
      console.error("Failed to delete fault tree:", error);
      addToast({ 
        id: GenerateUUID(), 
        ...allToasts.find(t => t.type === "error")! 
      });
    }
  };

  if (isLoading) {
    return <div>Loading fault trees...</div>;
  }

  return (
    <FaultTreeListZustand
      name="fault-tree"
      faultTreeList={faultTrees}
      addFaultTree={addFaultTreeHandler}
      getFaultTree={getFaultTreeHandler}
      deleteFaultTree={deleteFaultTreeHandler}
      editFaultTree={editFaultTreeHandler}
    />
  );
}

export { FaultTreeList };
