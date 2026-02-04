import React, { createContext, useContext, useState } from "react";

const PopupContext = createContext();

export function PopupProvider({ children }) {
  const [isPostAdOpen, setIsPostAdOpen] = useState(false);

  const openPostAd = () => setIsPostAdOpen(true);
  const closePostAd = () => setIsPostAdOpen(false);

  return (
    <PopupContext.Provider value={{ isPostAdOpen, openPostAd, closePostAd }}>
      {children}
    </PopupContext.Provider>
  );
}

export function usePopup() {
  return useContext(PopupContext);
}