import { create } from 'zustand';

interface RoomState {
  isConnected: boolean;
  activeUsers: number;
  isLocked: boolean;
  isNuked: boolean;

  // Actions
  setConnected: (status: boolean) => void;
  setActiveUsers: (count: number) => void;
  setLocked: (locked: boolean) => void;
  setNuked: (nuked: boolean) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  isConnected: false,
  activeUsers: 0,
  isLocked: false,
  isNuked: false,

  setConnected: (status) => set({ isConnected: status }),
  setActiveUsers: (count) => set({ activeUsers: count }),
  setLocked: (locked) => set({ isLocked: locked }),
  setNuked: (nuked) => set({ isNuked: nuked }),
}));
