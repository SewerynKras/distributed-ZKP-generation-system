import * as grpc from "@grpc/grpc-js";
import {
	G1Point,
	Groth16PiBPair,
	ProofResponse,
	type ProofRequest,
} from "../generated/grpc/proof_pb";
import { generateProof } from "../computation/proof-generator";
import type { NumericString } from "snarkjs";
import {
	type Empty,
	type JoinRequest,
	JoinResponse,
	KnownNode,
	NodesList,
	type PingMessage,
	PongMessage,
} from "../generated/grpc/network_pb";
import { addNode, getKnownNodes } from "../network/node-manager";
import type { RequestHandler } from "../types";
import { getErrorMessage } from "../utils";

export const generateProofHandler: RequestHandler<
	ProofRequest,
	ProofResponse
> = async (request) => {
	try {
		const { proof, publicSignals } = await generateProof(
			request.getStartingbalanceList(),
			request.getTransactionsList().map((t) => t.toObject()),
		);

		type CoordPair = [NumericString, NumericString];
		type CoordTriplet = [NumericString, NumericString, NumericString];

		function isCoordPair(coords: NumericString[]): coords is CoordPair {
			return coords.length === 2;
		}
		function isCoordTriplet(coords: NumericString[]): coords is CoordTriplet {
			return coords.length === 3;
		}
		function isTripletOfCoordPairs(
			coords: NumericString[][],
		): coords is [CoordPair, CoordPair, CoordPair] {
			return coords.length === 3 && coords.every(isCoordPair);
		}

		function toGrpcG1Point(point: NumericString[]): G1Point {
			if (!isCoordTriplet(point)) {
				throw new Error("Invalid coordinate");
			}
			const g1Point = new G1Point();
			g1Point.setX(point[0]);
			g1Point.setY(point[1]);
			g1Point.setZ(point[2]);
			return g1Point;
		}

		function toGrpcGroth16PiBPairList(
			point: NumericString[][],
		): Groth16PiBPair[] {
			if (!isTripletOfCoordPairs(point)) {
				throw new Error("Invalid coordinate");
			}
			const G1PointOverExtensionField0 = new Groth16PiBPair();
			G1PointOverExtensionField0.setC0(point[0][0]);
			G1PointOverExtensionField0.setC1(point[0][1]);

			const G1PointOverExtensionField1 = new Groth16PiBPair();
			G1PointOverExtensionField1.setC0(point[1][0]);
			G1PointOverExtensionField1.setC1(point[1][1]);

			const g1PointOverExtensionField = new Groth16PiBPair();
			g1PointOverExtensionField.setC0(point[2][0]);
			g1PointOverExtensionField.setC1(point[2][1]);

			return [
				G1PointOverExtensionField0,
				G1PointOverExtensionField1,
				g1PointOverExtensionField,
			];
		}

		const response = new ProofResponse();
		response.setPiA(toGrpcG1Point(proof.pi_a));
		response.setPiBList(toGrpcGroth16PiBPairList(proof.pi_b));
		response.setPiC(toGrpcG1Point(proof.pi_c));
		response.setProtocol(proof.protocol);
		response.setCurve(proof.curve);
		response.setPublicSignalsList(publicSignals);
		return { type: "success", response };
	} catch (error: unknown) {
		console.error("Error generating proof:", error);
		return {
			type: "error",
			error: {
				code: grpc.status.INTERNAL,
				message: `Internal server error: ${getErrorMessage(error)}`,
			},
		};
	}
};

export const getHandleGetNodesList: RequestHandler<Empty, NodesList> = async (
	_request,
	context,
) => {
	try {
		const NodeList = new NodesList();
		NodeList.setNodesList(
			getKnownNodes(context.getCurrentNodeState()).map((node) => {
				const knownNode = new KnownNode();
				knownNode.setNodeId(node.nodeId);
				knownNode.setHost(node.host);
				knownNode.setPort(node.port);
				return knownNode;
			}),
		);
		return { type: "success", response: NodeList };
	} catch (error: unknown) {
		console.error("Error getting nodes list:", error);
		return {
			type: "error",
			error: {
				code: grpc.status.INTERNAL,
				message: `Internal server error: ${getErrorMessage(error)}`,
			},
		};
	}
};

export const getHandleJoinNetwork: RequestHandler<
	JoinRequest,
	JoinResponse
> = async (request, context) => {
	try {
		const { nodeId, host, port } = request.toObject();
		const newNodeState = addNode(
			context.getCurrentNodeState(),
			nodeId,
			host,
			port,
		);
		const response = new JoinResponse();
		response.setTimestamp(Date.now());
		return { type: "success", response, nextState: newNodeState };
	} catch (error: unknown) {
		console.error("Error joining network:", error);
		return {
			type: "error",
			error: {
				code: grpc.status.INTERNAL,
				message: `Internal server error: ${getErrorMessage(error)}`,
			},
		};
	}
};

export const getHandlePing: RequestHandler<PingMessage, PongMessage> = async (
	_request,
	context,
) => {
	try {
		const response = new PongMessage();
		response.setNodeId(context.nodeId);
		response.setTimestamp(Date.now());
		return { type: "success", response };
	} catch (error: unknown) {
		console.error("Error pinging node:", error);
		return {
			type: "error",
			error: {
				code: grpc.status.INTERNAL,
				message: `Internal server error: ${getErrorMessage(error)}`,
			},
		};
	}
};
