import {
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
} from "@solana/actions";
import {
  clusterApiUrl,
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { NextResponse } from "next/server";
import * as anchor from "@coral-xyz/anchor";
import { MemePredict } from "@/contracts/types/meme_predict";
import IDL from "@/contracts/idl/meme_predict.json";
import { web3, BN } from "@coral-xyz/anchor";
import { getAssetByAddress } from "@/data/solanaAssests";

export const GET = async (req: Request) => {
  try {
    const query = req.url.split("?");
    const market = query[1].split("market=")[1];
    const marketId = parseInt(market);

    const marketData = await getMarketDetails(marketId);

    const tokenName = getAssetByAddress(marketData.coin.toString()).name; 
    const initialPrice =
      marketData.initialPrice.toNumber() / web3.LAMPORTS_PER_SOL;

    const payload: ActionGetResponse = {
      title: "Make Prediction",
      icon: new URL(
        "/meme-prediction-sq.png",
        new URL(req.url).origin,
      ).toString(),
      description: `Will ${tokenName} currently at ${initialPrice}USD, go up or down ?`,
      label: `Make prediction for ${tokenName}`,
      disabled: false, //TODO disable if voting time has passed
      links: {
        actions: [
          {
            label: "UP",
            href: `/api/actions/make_prediction?market=${marketId}&prediction=UP`,
          },
          {
            label: "DOWN",
            href: `/api/actions/make_prediction?market=${marketId}&prediction=DOWN`,
          },
        ],
      },
    };

    return NextResponse.json(payload, {
      headers: ACTIONS_CORS_HEADERS,
    });
  } catch (err) {
    console.log(err);
    let message = "An unknown error occurred";
    if (typeof err == "string") message = err;
    return new NextResponse(message, {
      status: 400,
      headers: ACTIONS_CORS_HEADERS,
    });
  }
};

// DO NOT FORGET TO INCLUDE THE `OPTIONS` HTTP METHOD
// THIS WILL ENSURE CORS WORKS FOR BLINKS
export const OPTIONS = GET;

export const POST = async (req: Request) => {
  try {
    const query = req.url.split("?")[1].split("&");
    const market = query[0].split("market=")[1];
    const marketId = parseInt(market);
    const prediction = query[1].split("prediction=")[1];

    // console.log("marketId", marketId)
    // console.log("prediction", prediction)

    if (!prediction || (prediction != "UP" && prediction != "DOWN")) {
      return new Response("Missing or Invalid prediction parameter", {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }

    const body: ActionPostRequest = await req.json();

    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch (err) {
      return new Response('Invalid "account" provided', {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }

    const connection = new Connection(
      process.env.SOLANA_RPC! || clusterApiUrl("devnet"),
    );
    const wallet = new anchor.Wallet(anchor.web3.Keypair.generate());
    const provider = new anchor.AnchorProvider(connection, wallet);

    const program = new anchor.Program(
      IDL as MemePredict,
      provider,
    ) as unknown as anchor.Program<MemePredict>;

    const instruction = await program.methods
      .makePrediction(
        new anchor.BN(marketId),
        prediction === "UP" ? true : false,
      )
      .instruction();

    const txn = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1000,
      }),
      instruction,
    );
    txn.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    txn.feePayer = account;

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction: txn,
        message: "Prediction Made!",
      },
      // no additional signers are required for this transaction
      // signers: [],
    });

    return NextResponse.json(payload, {
      headers: ACTIONS_CORS_HEADERS,
    });

  } catch (err) {
    console.log(err);
    let message = "An unknown error occurred";
    if (typeof err == "string") message = err;
    return new NextResponse(message, {
      status: 400,
      headers: ACTIONS_CORS_HEADERS,
    });
  }
};

async function getMarketDetails(marketId: number) {
  const connection = new Connection(
    process.env.SOLANA_RPC! || clusterApiUrl("devnet"),
  );
  const wallet = new anchor.Wallet(anchor.web3.Keypair.generate());
  const provider = new anchor.AnchorProvider(connection, wallet);

  const program = new anchor.Program(
    IDL as MemePredict,
    provider,
  ) as unknown as anchor.Program<MemePredict>;

  const [marketPDA] = findMarketPDA(marketId, program.programId);
  const marketAccount = await program.account.market.fetch(marketPDA);
  return marketAccount;
}

function findMarketPDA(
  marketId: number,
  programId: web3.PublicKey,
): [web3.PublicKey, number] {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("market", "utf8"),
      new BN(marketId).toArrayLike(Buffer, "le", 8),
    ],
    programId,
  );
}
