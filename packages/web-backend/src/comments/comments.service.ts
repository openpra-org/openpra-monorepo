import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Comments, CommentsDocument } from "./schemas/comments.schema";
import { Initiator } from "../initiators/schemas/initiator.schema";
import { v4 as uuidv4 } from "uuid";
import { Fmea } from "../fmea/schemas/fmea.schema"; // Import UUID generator

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comments.name)
    private readonly commentsModel: Model<CommentsDocument>,
  ) {}

  async getAllComments(associated_with: string): Promise<Comments[]> {
    const comments = await this.commentsModel.find({ associated_with });
    return comments;
  }

  async getCommentsById(
    associated_with: string,
    id: string,
  ): Promise<Comments | null> {
    const comment = await this.commentsModel.findOne({
      associated_with,
      _id: id,
    });
    return comment;
  }

  async updateCommentById(
    id: string,
    associated_with: string,
    comment: Comments,
  ): Promise<Comments | null> {
    const updatedComment = await this.commentsModel.findOneAndUpdate(
      { _id: id, associated_with: associated_with },
      comment,
      { new: true },
    );
    return updatedComment;
  }

  async createComments(comment: Comments): Promise<Comments> {
    const newComment = new this.commentsModel(comment);
    return newComment.save();
  }

  async deleteComment(
    associated_with: string,
    id: string,
  ): Promise<Comments | null> {
    const deletedComment = await this.commentsModel.findByIdAndDelete({
      associated_with: associated_with,
      _id: id,
    });
    return deletedComment;
  }

  // async deleteCommentsByAssociatedId(associated_with: string): Promise<number> {
  //   const result = await this.commentsModel.deleteMany({});
  //   return result.deletedCount;
  // }
}