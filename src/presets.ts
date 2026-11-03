export interface PresetItem {
  id: string;
  title: string;
  category: string;
  description: string;
  text: string;
}

export const PRESET_LESSONS: PresetItem[] = [
  {
    id: 'daily-conversation',
    title: '일상 생활 & 카페 주문',
    category: 'Daily Living',
    description: '원어민들이 자주 쓰는 카페 및 식당 주문 표현',
    text: `Good morning! Can I get a medium iced latte with oat milk, please?
Sure, would you like any extra syrup or espresso shots in that?
No thank you, just a single shot is perfect for me.
Are you having that here or taking it to go?
I will take it to go. By the way, could you also heat up this blueberry muffin?
Certainly! Your total comes to seven dollars and fifty cents.
Do you accept Apple Pay or should I use my physical card?
Both work great. Have a wonderful day ahead!`
  },
  {
    id: 'business-meeting',
    title: '비즈니스 회의 & 프로젝트 협의',
    category: 'Business English',
    description: '글로벌 업무 미팅에서 자주 쓰이는 핵심 커뮤니케이션 문장',
    text: `Thank you everyone for joining today's sprint review on such short notice.
Let's quickly align on the key deliverables before we dive into the metrics.
First, our engineering team has successfully launched the new payment gateway.
Initial user feedback has been overwhelmingly positive with a thirty percent drop in checkout latency.
Next, we need to address the customer onboarding bottleneck discovered last week.
Could you please share your screen and walk us through the proposed solution?
I recommend scheduling a dedicated follow-up workshop next Tuesday morning.
Let me summarize the action items and circulate the meeting notes by the end of today.`
  },
  {
    id: 'steve-jobs',
    title: '스티브 잡스 스탠포드 연설 발췌',
    category: 'Inspirational Speech',
    description: '명확한 발음과 감동적인 메시지가 담긴 스티브 잡스의 전설적인 연설문',
    text: `Your time is limited, so don't waste it living someone else's life.
Don't be trapped by dogma, which is living with the results of other people's thinking.
Don't let the noise of others' opinions drown out your own inner voice.
And most important, have the courage to follow your heart and intuition.
They somehow already know what you truly want to become.
Everything else is secondary.
Stay hungry. Stay foolish.`
  },
  {
    id: 'travel-airport',
    title: '해외 여행 & 공항 입국심사',
    category: 'Travel English',
    description: '공항 입국심사 및 호텔 체크인 시 필수 영어 회화',
    text: `May I see your passport and customs declaration form, please?
Here you go, sir.
What is the primary purpose of your visit to the United States?
I am here on vacation to visit family and explore national parks.
How long do you plan to stay in the country?
I will be staying for exactly two weeks, and my return flight is booked for next Sunday.
Where will you be staying during your trip?
I have a reservation at the Grand Central Hotel in downtown Chicago.
Welcome to Chicago, and enjoy your stay!`
  },
  {
    id: 'aesop-fable',
    title: '이솝 우화: 토끼와 거북이',
    category: 'Storytelling',
    description: '스토리텔링과 자연스러운 문맥 연결을 연습하기 좋은 숏 스토리',
    text: `A Hare was once ridiculing the slow feet of a Tortoise.
The Tortoise smiled and challenged the boastful Hare to a race.
The Hare accepted immediately, thinking it would be an effortless victory.
When the race began, the Hare darted far ahead in mere seconds.
Feeling entirely confident, he decided to take a short nap beneath a shady oak tree.
Meanwhile, the patient Tortoise plodded along step by step without ever stopping.
When the arrogant Hare finally woke up, he saw the Tortoise crossing the finish line.
Slow and steady wins the race.`
  }
];
