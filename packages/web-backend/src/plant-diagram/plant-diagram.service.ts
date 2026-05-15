import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import mongoose from "mongoose";
import { ModelCounter, ModelCounterDocument } from "../schemas/model-counter.schema";
import { PlantDiagram, PlantDiagramDocument } from "./schemas/plant-diagram.schema";
@Injectable()
export class PlantDiagramService implements OnModuleInit {
  constructor(
    @InjectModel(PlantDiagram.name)
    private readonly plantDiagramModel: mongoose.Model<PlantDiagramDocument>,
    @InjectModel(ModelCounter.name)
    private readonly modelCounterModel: mongoose.Model<ModelCounterDocument>,
  ) {}
  async onModuleInit(): Promise<void> {
    try {
      await this.modelCounterModel.collection.dropIndex("seq_1");
    } catch {}
  }
  private async getNextValue(name: string): Promise<number> {
    const record = await this.modelCounterModel.findByIdAndUpdate(
      name,
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    return record.seq;
  }
  async create(body: Partial<PlantDiagram>): Promise<PlantDiagram> {
    const doc = new this.plantDiagramModel({
      id: await this.getNextValue("PlantDiagramCounter"),
      typedModelId: body.typedModelId !== undefined ? Number(body.typedModelId) : undefined,
      title: body.title ?? "Untitled Diagram",
      description: body.description ?? "",
      diagramType: body.diagramType ?? "PID",
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    await doc.save();
    return doc;
  }
  async findByModelId(typedModelId: number): Promise<PlantDiagram[]> {
    return this.plantDiagramModel.find({ typedModelId: Number(typedModelId) }, { _id: 0 }).lean();
  }
  async findById(id: number): Promise<PlantDiagram | null> {
    return this.plantDiagramModel.findOne({ id: Number(id) }, { _id: 0 }).lean();
  }
  async updateDiagram(id: number, body: Partial<PlantDiagram>): Promise<PlantDiagram | null> {
    const update: Partial<PlantDiagram> = {};
    if (body.title !== undefined) update.title = body.title;
    if (body.description !== undefined) update.description = body.description;
    if (body.diagramType !== undefined) update.diagramType = body.diagramType;
    if (body.nodes !== undefined) update.nodes = body.nodes;
    if (body.edges !== undefined) update.edges = body.edges;
    if (body.viewport !== undefined) update.viewport = body.viewport;
    return this.plantDiagramModel.findOneAndUpdate({ id: Number(id) }, { $set: update }, { new: true }).lean();
  }
  async delete(id: number): Promise<void> {
    await this.plantDiagramModel.findOneAndDelete({ id: Number(id) });
  }
}
