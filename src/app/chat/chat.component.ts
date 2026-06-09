import { Component, inject, OnInit } from '@angular/core';
import { SupabaseChatService, Message } from '../supabase-chat.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Slider, } from 'primeng/slider';
import { ToastModule } from 'primeng/toast';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';

@Component({
    selector: 'app-chat',
    templateUrl: './chat.component.html',
    styleUrls: ['./chat.component.css'],
    imports: [FormsModule, CommonModule, Slider, ToastModule, TranslateModule]
})
export class ChatComponent implements OnInit {
    private readonly chatService = inject(SupabaseChatService);
    private readonly messageService = inject(MessageService);
    private readonly translateService = inject(TranslateService);
    messages: Message[] = [];
    users: { id: number; name: string }[] = [];
    selectedUserId: number | null = null;
    newMessage = '';
    fontSize!: number;
    ngOnInit() {
        this.chatService.messages$.subscribe(msgs => {
            const oldMessagesArr = this.messages;
            const oldMessagesStr = JSON.stringify(oldMessagesArr);
            const newMessagesStr = JSON.stringify(msgs);
            if (oldMessagesArr.length > 0 && oldMessagesStr !== newMessagesStr) {
                setTimeout(() => {
                    this.messageService.add({
                        summary: this.translateService.instant('CHAT.TITLE'),
                        detail: this.translateService.instant('CHAT.DETAIL'),
                        key: 'tl',
                        severity: 'info',
                    });
                });
            }
            this.messages = msgs;
        });
        this.fetchUsers();
        this.fontSize = Number(localStorage.getItem('chat-font-size') ?? 16);
    }

    updateFontSize(event: number) {
        const savedFontSize = Number(localStorage.getItem('chat-font-size') ?? 0);
        if (event && Number(event) !== savedFontSize) {
            localStorage.setItem('chat-font-size', event.toString());
        }
    }

    onUserChange(event: number | null) {
        localStorage.setItem('chat-selected-user-id', (event ?? "").toString());
        void this.fetchUsers();
    }

    async fetchUsers() {
        const uniqueUsers = await this.fetchUsersWithLastBackupYear() ?? [{ id: 1, name: '' }];
        this.users = uniqueUsers;
        let savedUserId = localStorage.getItem('chat-selected-user-id');
        if (savedUserId === null) {
            localStorage.setItem('chat-selected-user-id', this.users[0].id.toString());
            savedUserId = this.users[0].id.toString();
        }
        if (this.users.length > 0) {
            const savedUserId = localStorage.getItem('chat-selected-user-id');
            this.selectedUserId = this.users.find(user => user.id === Number(savedUserId))?.id ?? this.users[0].id;
        }
    }

    async fetchUsersWithLastBackupYear() {
        const lastBackupYear = await this.getLastBackupYear();
        const { data, error } = await this.chatService['supabase']
            .from('users')
            .select('id, name, predictions!inner(backup_year)')
            .eq('predictions.backup_year', lastBackupYear);

        // Remove the predictions property from each user object
        if (data) {
            data.forEach((user: { predictions?: unknown }) => {
                delete user.predictions;
            });
        }
        if (!error && data) {
            // Remove duplicate users if any
            const uniqueUsers = Array.from(new Map(data.map(u => [u.id, u])).values());
            return uniqueUsers;
        }
        return null;
    }

    async getLastBackupYear() {
        const { data, error } = await this.chatService['supabase']
            .from('predictions')
            .select('backup_year, date, user_id')
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!error && data) {
            return data.backup_year;
        }
        return null;
    }

    async sendMessage() {
        if (this.selectedUserId && this.newMessage.trim()) {
            await this.chatService.sendMessage(this.selectedUserId, this.newMessage.trim());
            this.newMessage = '';
        }
    }
}
