import { create } from 'zustand';

interface RoomState {
  isConnected: boolean;
  isNuked: boolean;

  // Actions
  setConnected: (status: boolean) => void;
  setNuked: (nuked: boolean) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  isConnected: false,
  isNuked: false,

  setConnected: (status) => set({ isConnected: status }),
  setNuked: (nuked) => set({ isNuked: nuked }),
}));
