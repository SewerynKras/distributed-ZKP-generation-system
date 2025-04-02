import type * as grpc from "@grpc/grpc-js";
import {
	G1Point,
	FieldExtPointCoordinate,
	ProofResponse,
	type ProofRequest,
} from "../generated/grpc/proof_pb";
import { generateProof } from "../computation/proof-generator";
import type { Groth16Proof, NumericString } from "snarkjs";
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
import type { NodeContext } from "../types";

export async function generateProofHandler(
	request: grpc.ServerUnaryCall<ProofRequest, ProofResponse>,
	callback: grpc.sendUnaryData<ProofResponse>,
) {
	const { proof, publicSignals } = await generateProof(
		request.request.getStartingbalanceList(),
		request.request.getTransactionsList().map((t) => t.toObject()),
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

	function toGrpcG1Point(
		point: Groth16Proof["pi_a"] | Groth16Proof["pi_c"],
	): G1Point {
		if (!isCoordTriplet(point)) {
			throw new Error("Invalid coordinate");
		}
		const g1Point = new G1Point();
		g1Point.setX(point[0]);
		g1Point.setY(point[1]);
		g1Point.setZ(point[2]);
		return g1Point;
	}

	function toGrpcCoordinateList(
		point: Groth16Proof["pi_b"],
	): FieldExtPointCoordinate[] {
		if (!isTripletOfCoordPairs(point)) {
			throw new Error("Invalid coordinate");
		}
		const G1PointOverExtensionField0 = new FieldExtPointCoordinate();
		G1PointOverExtensionField0.setX(point[0][0]);
		G1PointOverExtensionField0.setY(point[0][1]);

		const G1PointOverExtensionField1 = new FieldExtPointCoordinate();
		G1PointOverExtensionField1.setX(point[1][0]);
		G1PointOverExtensionField1.setY(point[1][1]);

		const g1PointOverExtensionField = new FieldExtPointCoordinate();
		g1PointOverExtensionField.setX(point[2][0]);
		g1PointOverExtensionField.setY(point[2][1]);

		return [
			G1PointOverExtensionField0,
			G1PointOverExtensionField1,
			g1PointOverExtensionField,
		];
	}

	const response = new ProofResponse();
	response.setPiA(toGrpcG1Point(proof.pi_a));
	response.setPiBList(toGrpcCoordinateList(proof.pi_b));
	response.setPiC(toGrpcG1Point(proof.pi_c));
	response.setProtocol(proof.protocol);
	response.setCurve(proof.curve);
	response.setPublicSignalsList(publicSignals);
	callback(null, response);
}

export function getHandleGetNodesList(context: NodeContext) {
	return async function handleGetNodesList(
		_request: grpc.ServerUnaryCall<Empty, NodesList>,
		callback: grpc.sendUnaryData<NodesList>,
	) {
		const NodeList = new NodesList();
		NodeList.setNodesList(
			getKnownNodes(context.knownNodes).map((node) => {
				const knownNode = new KnownNode();
				knownNode.setNodeId(node.nodeId);
				knownNode.setHost(node.host);
				knownNode.setPort(node.port);
				return knownNode;
			}),
		);
		callback(null, NodeList);
	};
}

export function getHandleJoinNetwork(context: NodeContext) {
	return async function handleJoinNetwork(
		request: grpc.ServerUnaryCall<JoinRequest, JoinResponse>,
		callback: grpc.sendUnaryData<JoinResponse>,
	) {
		const { nodeId, host, port } = request.request.toObject();
		const newKnownNodes = addNode(context.knownNodes, nodeId, host, port);
		context.knownNodes = newKnownNodes;
		const response = new JoinResponse();
		response.setTimestamp(Date.now());
		callback(null, response);
	};
}

export function getHandlePing(context: NodeContext) {
	return async function handlePing(
		_request: grpc.ServerUnaryCall<PingMessage, PongMessage>,
		callback: grpc.sendUnaryData<PongMessage>,
	) {
		const response = new PongMessage();
		response.setNodeId(context.nodeId);
		response.setTimestamp(Date.now());
		callback(null, response);
	};
}
