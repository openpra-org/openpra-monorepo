import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Comments, CommentsDocument } from "./schemas/comments.schema";
import {Initiator} from "../initiators/schemas/initiator.schema";

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comments.name)
    private readonly commentsModel: Model<CommentsDocument>,
  ) {}

  async getAllComments(associated_with: string): Promise<Comments[]> {
    const comments = await this.commentsModel.find({ associated_with });
    return comments;
  };

  async getCommentsById(associated_with: string, id: string): Promise<Comments | null> {
    const comment = await this.commentsModel.findOne({ associated_with, _id: id });
    return comment;
  };


  async createComments(comment: Comments): Promise<Comments> {
    const newComment = new this.commentsModel(comment);
    return newComment.save();
  }
}
