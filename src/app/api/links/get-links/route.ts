import { verifyToken } from "@/lib/authJWT";
import { dbConnection } from "@/lib/dbconnect";
import { LinkModel } from "@/models/link.model";
import { decryptLink } from "@/lib/linkCrypto";
import { userModel } from "@/models/user.model";
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

const PAGE_SIZE = 10;

// Escape regex metacharacters so a user's search string is matched literally
// (prevents regex injection / catastrophic backtracking against the DB).
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  await dbConnection();
  try {
    
    const token = await verifyToken(request)
    // Clamp to a valid 1-based page; a missing/NaN/negative value falls back to 1.
    const parsedPage = parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const filter = request.nextUrl.searchParams.get("filter") // search filter
    if (!token) {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }
    const { _id } = token.payload;

    const user = await userModel.findById(_id);
    const admin = user?.admin;
    let matchCondition: any = {};

    if (!admin) {
      matchCondition = { 
        user: new mongoose.Types.ObjectId(_id), 
        isDeleted: false 
      };
    }

    if (filter) {
      const safeFilter = escapeRegex(filter);
      matchCondition["$or"] = [
        { title: { $regex: safeFilter, $options: "i" } },
        { tags: { $regex: safeFilter, $options: "i" } },
      ];
    }

    const links = await LinkModel.aggregate([
      { $match: matchCondition},
      // ned to add serch filetr
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * PAGE_SIZE },
      { $limit: PAGE_SIZE },
      {
        $project: {
          _id: 1,
          title: 1,
          link: 1,
          tags: 1,
          createdAt: 1,
          user: 1,
          isDeleted: 1,
        },
      },
    ]);
    const response = NextResponse.json(
      {
        success: true,
        data: links.map((l) => ({ ...l, link: decryptLink(l.link) })),
        message: "Successfullt got the user links",
      },
      { status: 200 }
    );
    return response;
  } catch (error: any) {
    console.error("Error while getting links:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An error occurred while getting links",
      },
      { status: 500 }
    );
  }
}
