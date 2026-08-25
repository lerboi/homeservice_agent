/**
 * Mock for livekit-server-sdk — used in test-call and other tests
 * that interact with LiveKit SIP/Room services.
 */

export const RoomServiceClient = jest.fn().mockImplementation(() => ({
  createRoom: jest.fn().mockResolvedValue({}),
  removeParticipant: jest.fn().mockResolvedValue({}),
}));

export const SipClient = jest.fn().mockImplementation(() => ({
  createSipParticipant: jest.fn().mockResolvedValue({}),
  transferSipParticipant: jest.fn().mockResolvedValue({}),
}));

export const EgressClient = jest.fn().mockImplementation(() => ({
  startRoomCompositeEgress: jest.fn().mockResolvedValue({ egressId: 'mock-egress-id' }),
  stopEgress: jest.fn().mockResolvedValue({}),
}));

export const AgentDispatchClient = jest.fn().mockImplementation(() => ({
  createDispatch: jest.fn().mockResolvedValue({ id: 'mock-dispatch-id' }),
}));

export const AccessToken = jest.fn().mockImplementation(() => ({
  addGrant: jest.fn(),
  toJwt: jest.fn().mockResolvedValue('mock-jwt'),
}));
