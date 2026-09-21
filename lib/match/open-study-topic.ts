/** Preserve an explicitly named, unfamiliar study subject. Exact lexical identity
 * only: no embeddings, guessed translations or compatibility claims. */
export function openStudyTopic(text: string): string | undefined {
  const normalized=text.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'");
  const found=new Set<string>();
  for(const clause of normalized.split(/[\n.!?;。！？；]+/)){
    if(/\b(?:not|never|except|don't|do not|no longer|quoted)\b|不想|不用|唔想|不是|引用/.test(clause))continue;
    const patterns=[
      /\b(?:study|studying|revise|revising|teach|teaching|learn|learning|tutor|tutoring|review|reviewing)\s+(?:in\s+)?(?!to\b|with\b|at\b|on\b|for\b|together\b)([a-z][a-z -]{1,70}?)(?=\s+(?:with|together|at|on|in|for|using|every|this|next|tomorrow|tonight|only|and|or)\b|[,，:]|$)/g,
      /(?:[复複][习習]|[学學][习習]|[温溫][习習]?|教)([\p{Script=Han}]{2,12}?)(?=(?:一起|一齊|一齐|可以|需要|每[周週]|明天|今晚|[，,。；;：:]|$))/gu,
    ];
    for(const pattern of patterns)for(const m of clause.matchAll(pattern)){
      const name=m[1].trim().replace(/\s+/g,' ');
      if(name.length<2||name.split(' ').length>5||/\b(?:me|you|us|them|someone|anyone|people|partner|partners|buddy|buddies|group|together|help|session|sessions|material|materials|anything|something|everything|it|this|that|my|your|our|the|a|an|to|can|need|want|free|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|同[学學]|一[齐齊起]|[书書]$/.test(name))continue;
      found.add(name);
    }
  }
  return found.size===1?`text-subject:${[...found][0]}`:undefined;
}
