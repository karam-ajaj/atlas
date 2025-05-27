import { createContext, useContext, useState } from "react";

const SelectionContext = createContext();

export function SelectionProvider({ children }) {
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  return (
    <SelectionContext.Provider value={{ selectedNodeId, setSelectedNodeId }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  return useContext(SelectionContext);
}
