import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import { Model } from 'mongoose';
import { HclService } from './hcl/hcl.service';
import { CreateNewUserDto } from './collab/dtos/create-new-user.dto';
import { UserCounter, UserCounterDocument } from './collab/schemas/user-counter.schema';
import { User, UserDocument } from './collab/schemas/user.schema';

@Injectable()
export class ApiService {
    constructor(
        private hclService: HclService,
        @InjectModel(UserCounter.name) private userCounterModel: Model<UserCounterDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>
    ) {}

    /** Generates an ID for the newly created user in an incremental order of 1. Initially if no user exists, the serial ID starts from 1. */
    async getNextUserValue(name: string) {
        let record = await this.userCounterModel.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true });
        if(!record) {
            let newCounter = new this.userCounterModel({ _id: name, seq: 1 });
            await newCounter.save();
            return newCounter.seq;
        }
        return record.seq;
    }

    /** Since right now only the HCL Model is supported, the app is going to look for HCL models that match with the provided keywords. */
    async searchCollabModel(user_id: number, key: string, type: string, url: string, limit?:any, offset?:any) {
        if(limit && offset) {
            return this.hclService.searchHclModel(user_id, key, type, url, limit, offset);
        } else {
            return this.hclService.searchHclModel(user_id, key, type, url, undefined, undefined);
        }
    }

    /**
    * There are some hard-coded data provided alongside the request body for creating a 'user' document:
    *   1. The password is encrypted using the 'argon2id' method.
    *   2. The UserID is generated in an incremental order using getNextUserValue() function.
    *   3. The name of the user is saved by simply joining the first and last names of the user.
    *   4. The 'recently_accessed' object contains a list of all the Models created by the user. By default its kept empty at first.
    *      The Projects and Subsystems have not been implemented yet. Whenever the user creates any new HCL tree inside a Model,
    *      the tree's info gets saved inside this Model list. After creating a tree, if it is viewed, edited or quantified - those
    *      information get saved as well - to get an idea about the activity of the user.
    *   5. Whenever a user is interacting with the tree editor, the user can enable or disable certain settings of the editor. Those settings
    *      are saved in the 'preferences' object. By default all the settings inside the 'preferences' are set to 'enabled' when a user is created.
    *   6. The permissions feature has not been implemented yet - so it is kept empty by default. Once implemented, a user will be able to assume
    *      one of the two roles - either the role of an administrator (with special access - such as deleting a user from the database) or the role of a general user.
    */
    async createNewUser(body: CreateNewUserDto): Promise<User> {
        body.password = await argon2.hash(body.password);
        const newUser = new this.userModel(body);
        newUser.id = await this.getNextUserValue('UserCounter');
        newUser.recently_accessed = {
            models: [],
            subsystems: [],
            projects: []
        };
        newUser.preferences = {
            theme: 'Light',
            nodeIdsVisible: true,
            outlineVisible: true,
            node_value_visible: true,
            nodeDescriptionEnabled: true,
            pageBreaksVisible: true,
            quantificationConfigurations: {
                configurations: {},
                currentlySelected: ' '
            }
        };
        return newUser.save();
    }
}